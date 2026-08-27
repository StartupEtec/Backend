# Sistema Centralizado de Notificaciones (Issue #58)

Sistema multi-canal (Push, Email, SMS) con persistencia en PostgreSQL, provedores
lazy-init, soporte DND, reintentos automáticos, y 7 endpoints REST documentados
en Swagger.

---

## Concepto

El sistema recibe eventos de dominio (nueva cotización, cambio de estado, mensaje,
etc.) y envía notificaciones al usuario destinatario por los canales que tenga
habilitados. Cada notificación se persiste en base de datos para auditing y
reintentos.

**Canales soportados:**

| Canal | Proveedor | SDK | Lazy-init |
|---|---|---|---|
| Push | Firebase Cloud Messaging | `firebase-admin` | `import()` dinámico |
| Email | SendGrid | `@sendgrid/mail` | `import()` dinámico |
| SMS | Twilio | `twilio` | `import()` dinámico |

Los providers usan **lazy async init**: importan su SDK la primera vez que se
necesita, para no romper la app si las credenciales no están configuradas.
En modo sin credenciales, simulan el envío y retornan un ID ficticio.

---

## Modelo de datos (migración `20260827000000_create_notifications_tables.js`)

### `notifications`

Registro centralizado de todos los envíos de notificaciones.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único autogenerado. |
| `user_id` | `UUID` | `FK → users`, `NOT NULL` | Usuario destinatario (CASCADE en delete). |
| `type` | `VARCHAR` | `NOT NULL` | Tipo de evento: `SERVICE_REQUEST`, `QUOTE_RECEIVED`, `QUOTE_ACCEPTED`, `SERVICE_COMPLETED`, `NEW_MESSAGE`, `ORDER_STATUS_CHANGE`. |
| `channels` | `JSONB` | `NOT NULL` | Canales objetivo: `["push", "email", "sms"]`. |
| `title` | `VARCHAR` | `NOT NULL` | Título de la notificación. |
| `body` | `TEXT` | `NOT NULL` | Cuerpo del mensaje. |
| `data` | `JSONB` | `NULLABLE` | Payload adicional: `order_id`, `chat_id`, `quote_id`, etc. |
| `status` | `VARCHAR` | `NOT NULL`, `DEFAULT 'PENDING'` | `PENDING`, `SENT`, `FAILED`, `READ`. |
| `read_at` | `TIMESTAMP` | `NULLABLE` | Fecha/hora en que el usuario leyó la notificación. |
| `failed_reason` | `TEXT` | `NULLABLE` | Motivo del fallo (si aplica). |
| `retry_count` | `INTEGER` | `DEFAULT 0` | Intentos de reenvío realizados. |
| `max_retries` | `INTEGER` | `DEFAULT 3` | Máximo de reintentos permitidos. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de creación. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Fecha de última modificación. |

**Índices:** `user_id`, `status`, `type`, `created_at`, `(user_id, status)`.

### `notification_preferences`

Preferencias de notificación por usuario (una fila por usuario).

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único autogenerado. |
| `user_id` | `UUID` | `FK → users`, `UNIQUE`, `NOT NULL` | Usuario propietario (CASCADE en delete). |
| `push_enabled` | `BOOLEAN` | `DEFAULT true` | Habilita notificaciones push. |
| `email_enabled` | `BOOLEAN` | `DEFAULT true` | Habilita notificaciones por email. |
| `sms_enabled` | `BOOLEAN` | `DEFAULT false` | Habilita notificaciones por SMS. |
| `dnd_start` | `TIME` | `NULLABLE` | Inicio del horario de no molestar (HH:MM). |
| `dnd_end` | `TIME` | `NULLABLE` | Fin del horario de no molestar (HH:MM). |
| `dnd_enabled` | `BOOLEAN` | `DEFAULT false` | Activa el modo Do Not Disturb. |
| `channels_config` | `JSONB` | `NULLABLE` | Configuración adicional por tipo de notificación. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de creación. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Fecha de última modificación. |

**Índices:** `user_id`.

---

## Máquina de estados de notificación

```
PENDING ──envío OK──▶ SENT ──usuario lee──▶ READ
   │
   │ envío falla
   ▼
 FAILED ──retry OK──▶ SENT
   │
   │ max_retries alcanzado
   ▼
 FAILED (terminal)
```

- `PENDING → SENT`: al menos un canal entregó exitosamente.
- `PENDING → FAILED`: todos los canales fallaron.
- `SENT → READ`: el usuario marcó la notificación como leída.
- `FAILED → SENT`: reintento exitoso (si `retry_count < max_retries`).

---

## Tipos de notificación

| Tipo | Trigger | Canales | Plantilla Push | Plantilla Email |
|---|---|---|---|---|
| `SERVICE_REQUEST` | Nueva solicitud de servicio | push, email, sms | "Nueva solicitud: {category}" | HTML con categoría |
| `QUOTE_RECEIVED` | Cotización recibida por cliente | push, email, sms | "Nueva cotización: ${price}" | HTML con monto |
| `QUOTE_ACCEPTED` | Cotización aceptada (escrow) | push, email, sms | "Cotización aceptada: ${price}" | HTML con monto + escrow |
| `SERVICE_COMPLETED` | Servicio completado (dual confirm) | push, email, sms | "Servicio completado" | HTML de confirmación |
| `NEW_MESSAGE` | Mensaje nuevo en chat | push, email, sms | "{sender}: {preview}" | HTML con remitente |
| `ORDER_STATUS_CHANGE` | Cambio de estado de orden | push, email, sms | "Orden: {new_status}" | HTML con transición |

**Excepciones DND:** `SERVICE_COMPLETED` y `ORDER_STATUS_CHANGE` se envían
incluso si el usuario está en horario de no molestar.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│  OrderService / QuoteService / MessageService            │
│  (emiten eventos de dominio)                             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  NotificationService  (orquestador central)              │
│                                                          │
│  1. Valida tipo de notificación                          │
│  2. Obtiene preferencias del usuario                     │
│  3. Verifica horario DND (bypass paracriticos)           │
│  4. Determina canales habilitados                        │
│  5. Crea registro en notifications (PENDING)             │
│  6. Despacha en paralelo a canales (Promise.allSettled)  │
│  7. Evalúa resultados → SENT o FAILED                    │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Firebase │ │ SendGrid │ │  Twilio  │
   │   (FCM)  │ │  (Email) │ │   (SMS)  │
   └──────────┘ └──────────┘ └──────────┘
```

---

## Endpoints (7)

Todas las rutas requieren `Authorization: Bearer <token>`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/notifications` | Listar notificaciones del usuario (paginación, filtros). |
| `GET` | `/api/v1/notifications/unread-count` | Conteo de notificaciones no leídas. |
| `PATCH` | `/api/v1/notifications/:id/read` | Marcar una notificación como leída. |
| `PATCH` | `/api/v1/notifications/read-all` | Marcar todas como leídas. |
| `GET` | `/api/v1/notifications/preferences` | Obtener preferencias de notificación. |
| `PATCH` | `/api/v1/notifications/preferences` | Actualizar preferencias (toggles + DND). |
| `POST` | `/api/v1/notifications/test` | Enviar notificación de prueba (solo desarrollo). |

### `GET /api/v1/notifications`

Parámetros de query:

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `limit` | integer | 20 | Máximo 50. |
| `offset` | integer | 0 | Desplazamiento para paginación. |
| `status` | string | — | Filtrar por: `PENDING`, `SENT`, `FAILED`, `READ`. |
| `type` | string | — | Filtrar por tipo de notificación. |

Respuesta `200`:
```json
{
  "notifications": [{ "id": "...", "type": "QUOTE_RECEIVED", "status": "SENT", ... }],
  "count": 5,
  "total": 23,
  "limit": 20,
  "offset": 0
}
```

### `PATCH /api/v1/notifications/preferences`

Body:
```json
{
  "push_enabled": false,
  "email_enabled": true,
  "sms_enabled": false,
  "dnd_enabled": true,
  "dnd_start": "22:00",
  "dnd_end": "08:00"
}
```

Todos los campos son opcionales. DND soporta horarios que cruzan medianoche
(ej: `22:00` → `06:00`).

### `POST /api/v1/notifications/test`

Body (opcional):
```json
{
  "type": "ORDER_STATUS_CHANGE",
  "channels": ["push", "email"]
}
```

Retorna `403` si `NODE_ENV=production`.

---

## Integración con servicios de dominio

Las notificaciones se disparan automáticamente desde los services existentes:

### `OrderService.updateOrderStatus()`

```
Cuando status cambia a un estado significativo:
  → notificationService.send(userId, 'ORDER_STATUS_CHANGE', { old_status, new_status, order_id })
```

### `OrderService.completeOrder()`

```
Cuando ambas partes confirman y la orden pasa a COMPLETED:
  → notificationService.send(clientUserId, 'SERVICE_COMPLETED', { order_id })
  → notificationService.send(workerUserId, 'SERVICE_COMPLETED', { order_id })
```

### `QuoteService.createQuote()`

```
Cuando un trabajador crea una cotización:
  → notificationService.send(clientUserId, 'QUOTE_RECEIVED', { order_id, price })
```

### `QuoteService.acceptQuote()`

```
Cuando el cliente acepta una cotización:
  → notificationService.send(workerUserId, 'QUOTE_ACCEPTED', { order_id, price })
```

### `MessageService.createMessage()`

```
Cuando se envía un mensaje en un chat:
  → notificationService.send(recipientUserId, 'NEW_MESSAGE', { sender_name, preview, chat_id })
```

Las llamadas a `notificationService.send()` son **fire-and-forget**: si fallan,
no bloquean la operación principal.

---

## Variables de entorno

```env
# Firebase Push (FCM)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# SendGrid Email
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=

# Twilio SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Notification Config
NOTIFICATION_DEFAULT_LIMIT=20
NOTIFICATION_MAX_RETRIES=3
```

Si las credenciales no están configuradas, los providers operan en **modo
simulación** y registran logs informativos.

---

## Seguridad

- **Autenticación requerida**: todas las rutas usan `authenticateToken` middleware.
- **Aislamiento de usuario**: cada endpoint filtra por `req.user.user_id`, no se
  puede acceder a notificaciones de otros usuarios.
- **DND bypass controlado**: solo `SERVICE_COMPLETED` y `ORDER_STATUS_CHANGE`
  ignoran el horario de no molestar (eventos críticos de pago/servicio).
- **Fire-and-forget**: las llamadas a providers externos no bloquean las
  operaciones de dominio. Si el envío falla, se registra el error y se reintenta.
- **Sin datos sensibles en logs**: solo se registran IDs, tipos y estados.
- **Test endpoint protegido**: `/test` retorna `403` en producción.

---

## Archivos afectados

| Archivo | Acción |
|---|---|
| `src/database/migrations/20260827000000_create_notifications_tables.js` | Crear |
| `src/services/NotificationService.js` | Crear |
| `src/services/providers/FirebasePushProvider.js` | Crear |
| `src/services/providers/SendGridEmailProvider.js` | Crear |
| `src/services/providers/TwilioSMSProvider.js` | Crear |
| `src/controllers/NotificationController.js` | Crear |
| `src/routes/notificationRoutes.js` | Crear |
| `src/services/OrderService.js` | Modificar (agregar notificaciones) |
| `src/services/QuoteService.js` | Modificar (agregar notificaciones) |
| `src/services/MessageService.js` | Modificar (agregar notificaciones) |
| `src/utils/validation.js` | Modificar (agregar schemas Joi) |
| `src/app.js` | Modificar (montar rutas) |
| `.env.example` | Modificar (agregar vars de entorno) |
| `tests/notificationService.test.js` | Crear |
| `tests/notification.integration.test.js` | Crear |
| `tests/order.test.js` | Modificar (mock de notificationService) |
| `tests/quote.test.js` | Modificar (mock + fix fechas) |
| `tests/messageService.test.js` | Modificar (mock de notificationService) |
| `docs/NOTIFICATION_SYSTEM.md` | Crear |

---

## Verificación

```bash
# Migrar base de datos
npx knex migrate:latest

# Verificar formato
npx prettier --check "src/**/*.js" "tests/**/*.js"

# Ejecutar tests
npm test

# Verificar syntax
node --check src/services/NotificationService.js
node --check src/controllers/NotificationController.js
node --check src/routes/notificationRoutes.js
```

**Resultado esperado:** 430 tests pasando, 0 fallos.
