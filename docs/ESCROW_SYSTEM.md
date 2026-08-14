# Sistema de Escrow (Issue #19)

Sistema de retención y liberación de fondos entre cliente y trabajador, con
transacciones atómicas y auditoría completa de cada cambio de estado.

---

## 🧠 Concepto

Al aceptar una cotización, el sistema **carga la tarjeta del cliente** y
**retiene el monto en escrow** (fondos congelados). Cuando el servicio se
**completa**, los fondos se transfieren de la wallet del cliente a la del
trabajador. Si la orden se **cancela**, el monto se **reembolsa** a la tarjeta
del cliente.

El cargo/reembolso a la tarjeta es una **simulación del proveedor de pagos**
(no hay gateway real en esta fase). La arquitectura está preparada para
sustituir `chargeCard`/`refundCard` por una integración real (Stripe,
MercadoPago, etc.) sin cambios en el resto del flujo.

---

## 💾 Modelo de datos (migración `20260815000000_create_escrow_system.js`)

### `transactions` (modificada)

Se agrega el estado `FAILED` y una restricción `CHECK` que restringe el dominio:

```
status IN ('PENDING', 'ESCROWED', 'COMPLETED', 'REFUNDED', 'FAILED')
```

| Campo | Descripción |
|---|---|
| `id` | UUID, PK |
| `order_id` | FK → `orders`, **UNIQUE** (una transacción por orden) |
| `payer_id` | FK → `users` (cliente que paga) |
| `receiver_id` | FK → `users` (trabajador que recibe) |
| `amount` | `DECIMAL(10,2)` |
| `status` | `PENDING`, `ESCROWED`, `COMPLETED`, `REFUNDED`, `FAILED` |
| `payment_method_id` | FK → `payment_methods` (tarjeta utilizada) |
| `created_at` / `updated_at` | Timestamps |

### `user_wallets` (nueva)

Saldo por usuario, separando fondos disponibles de fondos retenidos.

| Campo | Descripción |
|---|---|
| `id` | UUID, PK |
| `user_id` | FK → `users`, **UNIQUE** (una wallet por usuario) |
| `current_balance` | `DECIMAL(12,2)` — fondos **disponibles** (para el trabajador) |
| `escrowed_balance` | `DECIMAL(12,2)` — fondos **retenidos** en escrow (del cliente) |
| `created_at` / `updated_at` | Timestamps |

### `transaction_logs` (nueva)

Auditoría completa: una fila por cada cambio de estado de una transacción.

| Campo | Descripción |
|---|---|
| `id` | UUID, PK |
| `transaction_id` | FK → `transactions` (CASCADE) |
| `from_status` | Estado anterior |
| `to_status` | Estado nuevo |
| `changed_by_id` | FK → `users` (quién ejecutó el cambio, nullable) |
| `reason` | `TEXT` — motivo del cambio (nullable) |
| `created_at` | Timestamp |

---

## 🔁 Máquina de estados de la transacción

```
PENDING ──cargo OK──▶ ESCROWED ──orden COMPLETED──▶ COMPLETED
   │                      │
   │ cargo FALLA          │ orden CANCELLED (reembolso a tarjeta)
   ▼                      ▼
 FAILED                REFUNDED
```

- `PENDING → ESCROWED`: cargo a la tarjeta exitoso al aceptar la cotización.
- `PENDING → FAILED`: cargo rechazado → la orden se cancela automáticamente.
- `ESCROWED → COMPLETED`: la orden llega a `COMPLETED` → los fondos se liberan
  al trabajador.
- `ESCROWED → REFUNDED`: la orden se cancela → se reembolsa a la tarjeta.

---

## 🏗️ Flujos implementados

### 1. Aceptar cotización → iniciar escrow

`POST /api/v1/quotes/:quote_id` `{ "status": "ACCEPTED" }`

```
┌──────────────────────────────────────────────────────────────┐
│  QuoteService.acceptQuote  (transacción atómica)             │
│                                                              │
│  1. quote → ACCEPTED                                         │
│  2. cotizaciones hermanas pendientes → REJECTED              │
│  3. order → ACCEPTED                                         │
│  4. EscrowService.startEscrow(trx):                          │
│     a. INSERT transaction (PENDING)                          │
│     b. Simular cargo a tarjeta primaria del cliente          │
│        ├─ OK    → transaction ESCROWED                       │
│        │          wallet cliente.escrowed_balance += amount  │
│        │          log PENDING→ESCROWED                       │
│        └─ FALLO → transaction FAILED                         │
│                   order → CANCELLED (automático)             │
│                   log PENDING→FAILED                         │
└──────────────────────────────────────────────────────────────┘
```

Respuesta de éxito: `200` con la cotización `ACCEPTED`.
Respuesta de cargo fallido: `402 PAYMENT_FAILED` (la orden quedó `CANCELLED`).

### 2. Completar orden → liberar fondos

`PATCH /api/v1/orders/:id/status` `{ "status": "COMPLETED" }` (trabajador)

```
┌──────────────────────────────────────────────────────────────┐
│  OrderService.updateOrderStatus  (transacción atómica)       │
│                                                              │
│  1. order → COMPLETED + order_events                         │
│  2. EscrowService.releaseFunds(trx):                         │
│     a. Buscar transaction por order_id (única)               │
│     b. wallet cliente.escrowed_balance -= amount             │
│     c. wallet trabajador.current_balance += amount           │
│     d. transaction → COMPLETED                               │
│     e. log ESCROWED→COMPLETED                                │
└──────────────────────────────────────────────────────────────┘
```

Si la liberación falla (estado inválido), la transacción de BD se revierte y la
orden **no** cambia a `COMPLETED` (`409 INVALID_TRANSITION`).

### 3. Cancelar orden → reembolsar

`PATCH /api/v1/orders/:id/status` `{ "status": "CANCELLED" }` (cliente o trabajador)

```
┌──────────────────────────────────────────────────────────────┐
│  OrderService.updateOrderStatus  (transacción atómica)       │
│                                                              │
│  1. order → CANCELLED + order_events                         │
│  2. EscrowService.refund(trx):                               │
│     a. Buscar transaction por order_id                       │
│     b. Simular devolución a la tarjeta del cliente           │
│     c. wallet cliente.escrowed_balance -= amount             │
│     d. transaction → REFUNDED                                │
│     e. log ESCROWED→REFUNDED                                 │
└──────────────────────────────────────────────────────────────┘
```

- Si la orden se cancela desde `PENDING` (nunca se pagó), no existe
  transacción y **no se hace ningún movimiento** (no-op seguro).
- Si el reembolso a la tarjeta falla, la operación se revierte
  (`502 REFUND_FAILED`).

---

## 🔌 Simulación del proveedor de pagos

`EscrowService.chargeCard` / `EscrowService.refundCard` devuelven éxito por
defecto. Variables de entorno:

| Variable | Default | Descripción |
|---|---|---|
| `SIMULATE_CHARGE_FAILURE` | `false` | `true` fuerza el fallo del cargo a la tarjeta (prueba la cancelación automática) |

En la integración real basta con sustituir el cuerpo de `chargeCard` y
`refundCard` (ej. `stripe.charges.create` / `stripe.refunds.create`).

---

## 🛡️ Seguridad y transacciones

- **Atomicidad**: `startEscrow`, `releaseFunds` y `refund` reciben una
  transacción de BD (`trx`) iniciada por el llamador, por lo que el pago, los
  movimientos de wallets, el cambio de estado de la orden y los logs comparten
  el mismo `COMMIT`/`ROLLBACK`.
- **Un solo pago por orden**: índice `UNIQUE (order_id)` en `transactions`
  (violación → `409 PAYMENT_ALREADY_STARTED`).
- **Sin datos sensibles en logs**: solo se registran IDs, montos y
  referencias del proveedor; nunca el PAN ni el CVV.
- **Validación de entradas**: los esquemas Joi de `updateOrderStatusSchema` y
  `updateQuoteStatusSchema` restringen los estados permitidos antes de llegar
  al escrow.

---

## 📄 Archivos afectados

| Archivo | Acción |
|---|---|
| `src/database/migrations/20260815000000_create_escrow_system.js` | Crear |
| `src/services/EscrowService.js` | Crear |
| `src/services/QuoteService.js` | Modificar (`acceptQuote`) |
| `src/services/OrderService.js` | Modificar (`handleEscrowTransition`) |
| `src/controllers/QuoteController.js` | Modificar (`PAYMENT_FAILED` → 402) |
| `src/controllers/OrderController.js` | Modificar (`REFUND_FAILED` → 502) |
| `.env.example` | Modificar (`SIMULATE_CHARGE_FAILURE`) |
| `tests/escrow.test.js` | Crear |
| `tests/quote.test.js`, `tests/order.test.js` | Modificar |
| `docs/ESCROW_SYSTEM.md` | Crear |

---

## 🧪 Verificación

```bash
npm run migrate:latest
npm run format:check
npm test
```

Ejemplo de flujo completo (con `SIMULATE_CHARGE_FAILURE=false`):

1. Crear método de pago: `POST /api/v1/users/:id/payment-methods`
2. Crear cotización: `POST /api/v1/orders/:order_id/quotes`
3. Aceptar: `PATCH /api/v1/quotes/:quote_id` `{ "status": "ACCEPTED" }`
   → transacción `ESCROWED`, `user_wallets.escrowed_balance` retenido
4. Completar: `PATCH /api/v1/orders/:id/status` `{ "status": "COMPLETED" }`
   → transacción `COMPLETED`, saldo acreditado al trabajador

(El paso 1 usa el método de pago primario del cliente; sin tarjeta el cargo
falla con `402 PAYMENT_FAILED`.)
