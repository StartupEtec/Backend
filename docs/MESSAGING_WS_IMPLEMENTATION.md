# Implementación de Mensajería y WebSocket (Issue #27)

Este documento resume todo el trabajo realizado para implementar la mensajería en
tiempo real: envío, listado paginado y eliminación de mensajes, subida y compresión
de imágenes, y notificaciones por WebSocket. Incluye diseño, archivos
creados/modificados, decisiones tomadas, migraciones, pruebas y verificaciones.

---

## 1. Alcance

Backend de mensajería sobre la funcionalidad de chats existente (Issue #4):

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/v1/chats/:chat_id/messages` | JWT | Enviar mensaje (`TEXT`/`IMAGE`/`QUOTE`). |
| `GET` | `/api/v1/chats/:chat_id/messages` | JWT | Listar mensajes con paginación. Marca como leído. |
| `DELETE` | `/api/v1/messages/:message_id` | JWT | Eliminar mensaje (soft delete, solo el autor). |
| `WS` | `/ws?token=<accessToken>` | JWT | Conexión WebSocket para real-time messaging. |

El prerrequisito citado en la issue ("disponibilidad de trabajador #27") es un error de
plantilla; el prerrequisito real es la Issue #4 (chats), ya completada.

---

## 2. Decisiones de diseño

### 2.1 WebSocket con la librería `ws` (sin Socket.IO)
- Se usa el paquete `ws` puro. Socket.IO añade transporte y re-conexión automática que
  la capa de presentación (frontend) puede implementar igual de fácil.
- Los WebSocket nativos **no envían headers personalizados** en el handshake, así que la
  autenticación viaja en el query string: `ws://<host>/ws?token=<accessToken>`.
  Un token inválido provoca el cierre con código `1008`.
- El hub mantiene `clients: Map<user_id, Set<socket>>`, lo que permite **múltiples
  dispositivos por usuario** (cada socket conectado recibe el evento).

### 2.2 Soft delete de mensajes
- Se agrega `messages.deleted_at`. Permite emitir `message:deleted` sin destruir
  historial y mantener las FK/consultas simples.
- Los mensajes borrados se excluyen de: listado de mensajes, último mensaje del chat
  (`LEFT JOIN LATERAL`) y `unread_count` (todos en `ChatService` y `MessageService`).
- Solo el autor puede eliminar (`403 FORBIDDEN`).

### 2.3 Imágenes: multer (memory) + sharp + almacenamiento local
- Subida con `multer` en memoria (`memoryStorage`) para no escribir basura en disco:
  - `limits.fileSize = 5MB` → `LIMIT_FILE_SIZE`.
  - `fileFilter` solo `image/jpeg` y `image/png` → `INVALID_FILE_TYPE`.
- Compresión con `sharp`: redimensión a máx **1600px**, re-codificación JPEG **q80**,
  guardado como `<UPLOAD_DIR>/messages/<uuid>.jpg`.
- Los adjuntos se sirven con `express.static` desde `/uploads`. El diseño queda
  desacoplado para migrar después a S3/CloudFront sin tocar los servicios.
- Si la transacción de BD falla tras escribir el archivo, se elimina del disco
  (`ImageService.deleteStoredFile`) para no dejar huérfanos.

### 2.4 Transacciones atómicas
- `createMessage` inserta el mensaje y actualiza `chats.last_message_at` en una
  transacción Knex.
- `listMessages` marca `last_read_at` tras listar (requisito "marca mensajes como leído
  al cargar conversación").

### 2.5 Convenciones del repo respetadas
- ESM (`"type": "module"`), clases con `export default new X()`.
- Mensajes de error en español, formato estandarizado
  `{ error, message, statusCode, timestamp }`.
- `[AUDITORIA]` logs con Winston en operaciones de escritura.
- Migraciones Knex en `src/database/migrations`, Swagger vía bloques `@openapi`,
  tests con `jest.unstable_mockModule('../src/database/db.js')`.

---

## 3. Archivos nuevos

### 3.1 `src/utils/websocket.js` — hub WebSocket
- `attach(server)`: crea `WebSocketServer({ server, path: '/ws' })` reutilizando el
  HTTP server de Express.
- `handleConnection`: lee `token` del query string, lo verifica con
  `authService.verifyAccessToken`; si es inválido cierra con `1008`.
- Registra el socket en `clients` y envía `{ event: 'connected', payload: { user_id } }`.
- `handleClientMessage`: procesa mensajes entrantes; hoy solo `user:typing`.
- `relayTyping`: verifica participación activa en `chat_participants` (no reenvía a
  usuarios ajenos) y reenvía `user:typing` a los otros participantes.
- `sendToUser`/`sendToUsers`: envío con check `readyState === OPEN`.
- `removeClient`/`close`: limpieza de sockets y cierre ordenado en shutdown.

### 3.2 `src/services/MessageService.js`
- `createMessage(chatId, userId, data, file)`:
  1. Valida participación activa → `404 CHAT_NOT_FOUND`.
  2. Para `IMAGE`: exige `file.buffer` → `400 IMAGE_REQUIRED`; comprime con
     `ImageService` → `400 INVALID_IMAGE_TYPE`.
  3. Transacción: `INSERT` en `messages` + `UPDATE chats.last_message_at`.
  4. Si la transacción falla → elimina el archivo escrito y relanza.
  5. Emite `message:new` a los demás participantes.
  6. Log `[AUDITORIA] Mensaje enviado`.
- `listMessages(chatId, userId, { limit, offset })`:
  - Excluye `deleted_at`, orden `created_at DESC, id DESC` + `reverse()` (más
    recientes al final), `limit` clampado 1–100 (default 50).
  - Actualiza `last_read_at` del participante.
- `deleteMessage(messageId, userId)`:
  - `404 MESSAGE_NOT_FOUND` si no existe o ya está borrado.
  - `403 FORBIDDEN` si no es el autor.
  - Soft delete + emisión `message:deleted` + log `[AUDITORIA]`.

### 3.3 `src/services/ImageService.js`
- `compressAndStoreImage(buffer)`: detecta formato real con `sharp` (JPEG/PNG →
  `INVALID_IMAGE_TYPE`; imagen corrupta → `INVALID_IMAGE`), redimensiona a máx 1600px,
  comprime JPEG q80 y guarda en `<UPLOAD_DIR>/messages/<uuid>.jpg`.
  Devuelve `{ url: '/uploads/messages/<uuid>.jpg' }`.
- `deleteStoredFile(url)`: elimina el archivo (para revertir fallos).

### 3.4 `src/middlewares/upload.js`
- `uploadMessageImage`: multer memoryStorage, 5MB, fileFilter JPG/PNG.
- `handleUploadError`: **importante** — multer rechaza el archivo en el middleware,
  antes de llegar al controller, por lo que sus errores no pasan por el `try/catch` de
  este. Este middleware los traduce a `400 UPLOAD_ERROR` con mensaje legible
  ("La imagen no debe superar los 5MB", etc.).

### 3.5 `src/controllers/MessageController.js`
- `create`: valida con `createMessageSchema`, delega en el servicio, mapea errores
  (`404 CHAT_NOT_FOUND`, `400 IMAGE_REQUIRED`/`INVALID_IMAGE`/`INVALID_IMAGE_TYPE`,
  `400 VALIDATION_ERROR`) → `201`.
- `list`: valida `listMessagesQuerySchema`, mapea `404` → `200 { messages, count, limit, offset }`.
- `remove`: mapea `404`/`403` → `200 { message: 'Mensaje eliminado correctamente' }`.

### 3.6 `src/routes/messageRoutes.js`
```
DELETE /:message_id  → messageController.remove  (authenticateToken)
```
Montado en `/api/v1/messages` (router separado para no colisionar con
`GET /chats/:chat_id`).

### 3.7 Migraciones
- `src/database/migrations/20260808000000_add_message_soft_delete.js`
  - `messages.deleted_at` (soft delete).
  - Índice compuesto `messages_chat_created_idx ON messages (chat_id, created_at DESC)`
    para el listado paginado por chat.
- `src/database/migrations/20260808010000_messages_content_nullable.js`
  - `messages.content` pasa de `NOT NULL` a `NULLABLE`.
  - **Motivo**: el schema inicial tenía `content NOT NULL`; los mensajes `IMAGE` sin
    texto insertan `NULL` y el insert fallaba con violación de NOT NULL (bug 500
    detectado en el E2E).

### 3.8 Tests
- `tests/messageService.test.js` (18 tests): creación TEXT/IMAGE/QUOTE, validaciones de
  imagen, transacción + rollback de archivo, emisión de eventos WS, listado (paginación,
  exclusión de borrados, marca de leído), eliminación (404/403/éxito + evento).
- `tests/messageController.test.js` (12 tests): códigos HTTP 201/400/403/404 y formato
  de error estandarizado.
- `tests/websocket.test.js` (8 tests): auth por token (1008), registro de clientes
  multi-dispositivo, `connected`, relay de `user:typing` (participante vs. ajeno), envío
  a usuarios, limpieza de clientes.

---

## 4. Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/routes/chatRoutes.js` | `POST /:chat_id/messages` (con `uploadMessageImage.single('file')` + `handleUploadError`) y `GET /:chat_id/messages`. |
| `src/app.js` | Import de `messageRoutes`, montaje en `/api/v1/messages` y `express.static` en `/uploads`. |
| `src/server.js` | `websocketHub.attach(server)` tras `app.listen` y `websocketHub.close()` en shutdown. |
| `src/services/ChatService.js` | Excluye `deleted_at` en el último mensaje (LATERAL), `unread_count` y detalle `getChat`. |
| `src/utils/validation.js` | `createMessageSchema` (tipos válidos, `content` máx 5000, custom que exige `content` para TEXT/QUOTE) y `listMessagesQuerySchema` (default 50, máx 100). |
| `src/utils/swagger.js` | Schemas (`CreateMessageRequest`, `CreateMessageResponse`, `ListMessagesResponse`, `MessageNotFoundError`) y paths `/chats/{chat_id}/messages` (POST/GET), `/messages/{message_id}` (DELETE) y `/ws` con la documentación de eventos. |
| `.env.example` | `UPLOAD_DIR=uploads`. |
| `.gitignore` | `uploads/`. |
| `package.json` | Dependencias `ws`, `multer`, `sharp`. |
| `README.md` | Secciones de endpoints de mensajería y tabla de eventos WebSocket. |
| `docs/DATABASE_SCHEMA.md` | Tabla `messages` actualizada (`deleted_at`, `content` nullable, índice) y sección "Sistema de Mensajería y WebSocket (Issue #27)". |
| `docs/CHAT_IMPLEMENTATION.md` | Sección 8 "Mensajería y WebSocket (Issue #27)". |

---

## 5. Contrato WebSocket

### Conexión

```
ws://<host>/ws?token=<accessToken>
```

Respuesta inicial del servidor:

```json
{ "event": "connected", "payload": { "user_id": "..." } }
```

Si el token falta o es inválido → cierre con código `1008`.

### Eventos servidor → cliente

| Evento | Payload | Cuándo |
|--------|---------|--------|
| `connected` | `{ user_id }` | Al autenticarse la conexión. |
| `message:new` | `{ chat_id, message }` | Nuevo mensaje en un chat del usuario (se envía a los demás participantes, no al autor). |
| `message:deleted` | `{ chat_id, message_id }` | Mensaje eliminado por su autor. |
| `user:typing` | `{ chat_id, user_id, is_typing }` | Otro participante escribe. |

### Eventos cliente → servidor

| Tipo | Payload | Descripción |
|------|---------|-------------|
| `user:typing` | `{ chat_id, is_typing }` | Notifica al resto de participantes que el usuario está escribiendo. |

---

## 6. Contrato HTTP de mensajes

### `POST /api/v1/chats/:chat_id/messages`
- `Content-Type: application/json` para `TEXT`/`QUOTE`:
  ```json
  { "message_type": "TEXT", "content": "Hola" }
  ```
- `Content-Type: multipart/form-data` para `IMAGE`:
  - campo `message_type: IMAGE`
  - campo `file` (JPG/PNG, máx 5MB)
- Respuesta `201`: `{ message: { id, chat_id, sender_id, content, message_type, attachment_url, created_at } }`
- Errores: `400 VALIDATION_ERROR`, `400 IMAGE_REQUIRED`, `400 INVALID_IMAGE`,
  `400 INVALID_IMAGE_TYPE`, `400 UPLOAD_ERROR`, `404 CHAT_NOT_FOUND`.

### `GET /api/v1/chats/:chat_id/messages?limit=&offset=`
- Default `limit=50`, máx 100; mensajes no borrados, más recientes al final.
- Marca la conversación como leída.
- Respuesta `200`: `{ messages, count, limit, offset }`.

### `DELETE /api/v1/messages/:message_id`
- `200 { message: 'Mensaje eliminado correctamente' }`
- `403 FORBIDDEN` (no es el autor), `404 MESSAGE_NOT_FOUND`.

---

## 7. Bugs detectados por el E2E y corregidos

1. **Mensajes IMAGE → 500** (`null value in column "content"`): el schema inicial tenía
   `content NOT NULL`. Se creó y aplicó la migración
   `20260808010000_messages_content_nullable.js`.
2. **Errores de multer → 500**: el `fileFilter` y el límite de tamaño rechazan el archivo
   en el middleware, antes del controller, así que el `try/catch` del controller nunca los
   veía y caían en el error handler central. Se agregó `handleUploadError` en la ruta, que
   responde `400 UPLOAD_ERROR`.

---

## 8. Verificación ejecutada

| Verificación | Resultado |
|---|---|
| `npm run format:check` | ✅ "All matched files use Prettier code style!" |
| `npm test` | ✅ 12 suites, **224/224 tests** (38 nuevos). |
| Migraciones | ✅ `Batch 3` (soft delete) y `Batch 4` (content nullable) aplicadas; confirmadas con `\d messages` (`deleted_at`, índice, `content` nullable). |
| Swagger | ✅ `GET /api/v1/api-docs` compila; incluye `/chats/{chat_id}/messages`, `/messages/{message_id}`, `/ws` y schemas de mensajes. |
| E2E real (DB `ondemand_db`, clientes WebSocket reales) | ✅ **26/26 checks** — ver detalle abajo. |

### 8.1 E2E — checks cubiertos
- Creación de chat y autenticación WS de ambos usuarios (`connected`).
- `POST TEXT` → `201` y `message:new` recibido por el otro participante.
- `user:typing` de B → `user:typing` recibido por A (con `user_id` correcto).
- Listado paginado (default 50, `limit=1`, exclusión de borrados).
- `POST IMAGE` multipart → `201`, `attachment_url`, y el archivo servido está
  redimensionado a 1600px y comprimido (tamaño menor al original).
- Imagen de tipo inválido y archivo >5MB → `400 UPLOAD_ERROR`.
- `DELETE` por no-autor → `403 FORBIDDEN`; por autor → `200` + `message:deleted` recibido.
- Marca de leído al cargar la conversación.
- `TEXT` sin `content` → `400 VALIDATION_ERROR`.
- Usuario fuera del chat → `404`.
- Conexión WS sin token → rechazada con `1008`.

> Nota: los primeros fallos de `connected`/`message:new` en el E2E eran un **race en el
> script de prueba** (se adjuntaba el listener después de que el evento ya se había
> emitido), no del servidor; se confirmó con un script de depuración que el hub entrega
> todos los eventos correctamente.

---

## 9. Notas operativas

- Levantar la API en local (sin `.env`):
  ```bash
  docker start ondemand_db
  DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=postgres \
  DB_PASSWORD=postgres_secure_password DB_NAME=ondemand_db \
  JWT_SECRET=dev_secret_123 REFRESH_TOKEN_SECRET=dev_secret_123 npm run dev
  ```
- Aplicar migraciones:
  ```bash
  DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=postgres \
  DB_PASSWORD=postgres_secure_password DB_NAME=ondemand_db npx knex migrate:latest
  ```
- Swagger: `GET /api/v1/api-docs`.
- WebSocket: `ws://localhost:3000/ws?token=<accessToken>`.
- Las imágenes se guardan en `uploads/messages/` (configurable con `UPLOAD_DIR`) y se
  sirven desde `GET /uploads/...`. La carpeta `uploads/` está en `.gitignore`.
- Ejecutar tests: `npm test` (usa `node --experimental-vm-modules` para Jest con ESM).
- Los scripts temporales del E2E (`e2e-messages.mjs`, `e2e-debug-ws.mjs`) fueron
  eliminados al finalizar.
