# 🔌 API Design

Convenciones y decisiones de diseño de la **API REST** versionada del backend.

---

## 🏷️ Base URL y versionado

- Base URL: `https://<host>/api/v1`
- Todas las rutas se montan bajo el prefijo `/api/v1` (ver `src/app.js`).
- **Versionado en la URL**: `/api/v1/`, `/api/v2/`, etc.
- **Regla de breaking change**: si un endpoint cambia de forma incompatible (payload, códigos, semántica), se incrementa a la siguiente versión (`/api/v2/`) manteniendo la anterior durante un período de transición.

```
POST /api/v1/auth/login
GET  /api/v1/orders
PATCH /api/v1/orders/:id/status
```

---

## ✍️ Naming de recursos

- **Recursos en plural** y **snake_case** para campos JSON (consistente con el schema de BD).
- **Identificadores**: `:id` (UUID v4) en el path para recursos individuales.
- Métodos HTTP según la operación:

| Verbo | Uso | Ejemplo |
|---|---|---|
| `GET` | Leer/consultar (sin efectos) | `GET /users/:id` |
| `POST` | Crear recurso o acción | `POST /orders` |
| `PATCH` | Actualización parcial | `PATCH /orders/:id/status` |
| `PUT` | Reemplazo completo | (rara vez usado) |
| `DELETE` | Eliminar | `DELETE /chats/:id` |

### Convenciones de rutas (compactas)

- Sub-recursos anidados: `POST /orders/:id/quotes`, `GET /orders/:id/ratings`.
- **Acciones** puntuales se modelan como verbos sobre sub-recursos en lugar de RPC:
  - `POST /auth/verify-otp`
  - `POST /auth/refresh-token`
  - `PATCH /orders/:id/status`
  - `POST /orders/:id/complete` (doble confirmación)

---

## 🔐 Autenticación y autorización en la API

- **Bearer Token**: `Authorization: Bearer <accessToken>`.
- `accessToken` (JWT, 1h) transporta `user_id`, `email` y `current_role`.
- El middleware `authenticateToken` valida el token; `requireRole([...])` valida el rol activo.
- Rol dual: `current_role` en el JWT puede ser `client` o `worker/provider` (equivalentes a efectos de autorización).

```bash
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <accessToken>"
```

> Detalle de los flujos en [AUTHENTICATION.md](./AUTHENTICATION.md).

---

## 🚨 Manejo de errores (estandarizado)

Todos los errores usan la misma **estructura JSON** y el código HTTP correspondiente.

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Email inválido",
  "statusCode": 400,
  "timestamp": "2026-06-30T12:00:00.000Z"
}
```

| Campo | Descripción |
|---|---|
| `error` | Código de error en `SNAKE_CASE` (máquina-legible). |
| `message` | Mensaje legible para el humano. |
| `statusCode` | Código HTTP de la respuesta. |
| `timestamp` | ISO 8601 en UTC. |

### Códigos de error comunes

| HTTP | `error` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Fallo de validación Joi en la entrada. |
| 400 | `INVALID_OTP` | OTP incorrecto/expirado. |
| 401 | `UNAUTHORIZED` / `AUTH_FAILED` / `INVALID_REFRESH_TOKEN` | Credenciales o token ausente/vencido. |
| 402 | `PAYMENT_FAILED` | Cargo a la tarjeta falló en el escrow. |
| 403 | `FORBIDDEN` | Token inválido/expirado o sin permisos de rol. |
| 404 | `*_NOT_FOUND` | Recurso inexistente. |
| 409 | `CONFLICT_ERROR`, `INVALID_TRANSITION`, `ALREADY_CONFIRMED`, etc. | Estado inválido o recurso duplicado. |
| 429 | `TOO_MANY_REQUESTS` | Rate limit excedido. |
| 500 | `INTERNAL_SERVER_ERROR` | Error no controlado. |
| 502 | `REFUND_FAILED` | Falló el reembolso en el escrow. |

### Reglas de seguridad en errores

- **Nunca** se exponen al cliente: stack traces, queries SQL, ni detalles internos.
- Errores de negocio controlados devuelven su código; los no esperados van al middleware central (`src/app.js`) que responde `INTERNAL_SERVER_ERROR` genérico.

---

## 📄 Paginación

Los endpoints de listado devuelven paginación por **offset/limit** con metadatos:

```json
{
  "messages": [ ... ],
  "count": 50,
  "limit": 50,
  "offset": 0
}
```

- `limit`: tamaño de página (default 50, máx. 100).
- `offset`: desplazamiento desde el inicio.
- `count`: total de elementos de la página actual.

Ejemplos: `GET /messages?limit=20&offset=0`, `GET /workers/nearby?lat=...&lng=...&limit=20`.

---

## 🧾 Formato de respuestas

### Respuestas de creación/éxito

- **POST** → `201` (o `200` para acciones) con objeto `{ message, <recurso> }`.
- **GET (detalle)** → `200` con el objeto del recurso.
- **GET (lista)** → `200` con array paginado.

Ejemplo:

```json
{
  "message": "Ubicación creada correctamente",
  "location": { "id": "...", "address": "Calle Falsa 123" }
}
```

### Fechas y montos

- Fechas/horas en **ISO 8601** (`created_at`, `updated_at`).
- Fechas de servicios en `YYYY-MM-DD` (`proposed_date`), horas en `HH:mm` (`proposed_time`).
- Montos en **decimal** (`DECIMAL(10,2)` / `DECIMAL(12,2)`), valores positivos.

---

## 🔍 Validación de entrada

- Toda entrada se valida con **Joi** (esquemas en `src/utils/validation.js`).
- Centralización: Controller valida → descompone → llama al Service.
- Antes de la validación, una capa de **sanitización recursiva** limpia `body/query/params` de etiquetas HTML/scripts (prevención XSS).

---

## 📡 Eventos de tiempo real (WebSocket)

- Endpoint: `ws://<host>/ws?token=<accessToken>`
- Auth por token JWT en el *handshake*.
- Eventos: `message:new`, `message:deleted`, `typing:indicator`, `order:status_changed`, `order:completion_confirmed`, `notification`, `connected`.

```
ws://localhost:3000/ws?token=eyJhbGciOiJIUz...
```

---

## 📚 Documentación Swagger/OpenAPI

- **Spec**: `docs/openapi.yaml` (OpenAPI 3.0) — exportable con `npm run swagger:export`.
- **UI**: `http://localhost:3000/api-docs` (swagger-ui-express).
- Documenta: método HTTP, parámetros, request/response, códigos de error y ejemplos.
- Biola de seguridad: `bearerAuth` (JWT).

---

## 🧪 Ejemplos cURL (endpoints críticos)

### Autenticación (registro + login + OTP)

```bash
# 1. Registrar
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@example.com","phone":"3001234567","password":"P@ssword123!"}'

# 2. Login (envía OTP, retorna PENDING_VERIFICATION)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@example.com","password":"P@ssword123!"}'

# 3. Verificar OTP → devuelve accessToken + refreshToken
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@example.com","otp_code":"123456"}'

# 4. Renovar tokens (rotación)
curl -X POST http://localhost:3000/api/v1/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

### Flujo escrow (crear orden → cotización → aceptar → completar)

```bash
# Crear orden (como cliente)
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"...","worker_id":"...","category_id":"...","location_id":"..."}'

# Crear cotización (como trabajador)
curl -X POST http://localhost:3000/api/v1/orders/<order_id>/quotes \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"proposed_price":35000,"proposed_date":"2026-08-20","proposed_time":"14:30"}'

# Aceptar cotización → inicia escrow (retiene fondos)
curl -X PATCH http://localhost:3000/api/v1/quotes/<quote_id> \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"status":"ACCEPTED"}'

# Completar orden → libera fondos (doble confirmación)
curl -X POST http://localhost:3000/api/v1/orders/<order_id>/complete \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"confirm":true}'
```

> Más detalle de máquina de estados en [ORDER_STATE_MACHINE.md](./ORDER_STATE_MACHINE.md) y escrow en [ESCROW_SYSTEM.md](./ESCROW_SYSTEM.md).

---

## 🔗 Documentos relacionados

- [ARCHITECTURE.md](./ARCHITECTURE.md) — capas y flujos.
- [AUTHENTICATION.md](./AUTHENTICATION.md) — flujos de auth y tokens.
- [openapi.yaml](./openapi.yaml) — especificación OpenAPI completa.
