# Implementación del Sistema de Chats (Issue #4)

Este documento resume todo el trabajo realizado para implementar los endpoints de
gestión de chats, incluyendo el diseño, los archivos modificados/creados, las
decisiones tomadas y las verificaciones ejecutadas.

---

## 1. Alcance

Implementación de 4 endpoints REST con autenticación JWT, deduplicación de chats
por pareja de usuarios, soft delete individual y contador de mensajes no leídos:

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/v1/chats` | JWT | Crear chat con otro usuario (`user_id_2`, `order_id?`). Idempotente. |
| `GET` | `/api/v1/users/:id/chats` | JWT | Listar chats del usuario (solo propio) con paginación. |
| `GET` | `/api/v1/chats/:chat_id` | JWT | Detalle del chat + últimos 50 mensajes. Marca como leído. |
| `DELETE` | `/api/v1/chats/:chat_id` | JWT | Soft delete (oculta el chat solo para el usuario). |

---

## 2. Decisiones de diseño

### 2.1 Deduplicación por pareja
- Cada chat pertenece a **exactamente una pareja de usuarios**.
- Los pares se guardan de forma **canónica**: `user_id_1 < user_id_2`
  (`ChatService.canonicalPair`).
- Se agrega un índice `UNIQUE (user_id_1, user_id_2)` en la tabla `chats` para
  garantizar a nivel de BD que no existan dos chats para la misma pareja.
- `POST /chats` es **idempotente**: si la pareja ya tiene chat, responde
  `200` con el mismo `chat_id` y `created: false`.
- **Concurrencia**: si dos requests simultáneos intentan crear el mismo chat,
  uno falla con `23505` (unique violation); el código lo captura, re-consulta el
  chat existente y lo devuelve (ver `createChat` en `ChatService.js:112`).

### 2.2 Soft delete por participante
- Se crea la tabla `chat_participants` con la columna `deleted_at`.
- Al eliminar un chat, solo se setea `deleted_at` para el usuario autenticado;
  el chat desaparece **únicamente de su listado** y sigue visible para el otro
  participante.
- Al volver a llamar a `POST /chats`, la participación eliminada se reactiva
  (`deleted_at = null`, `reactivateParticipant`).

### 2.3 Mensajes no leídos
- `chat_participants.last_read_at` guarda cuándo el usuario abrió el chat.
- `unread_count` = mensajes con `sender_id != user_id` y
  `created_at > last_read_at` (o todos los ajenos si `last_read_at IS NULL`).
- Los mensajes enviados por el propio usuario **no** cuentan como no leídos.
- `GET /chats/:chat_id` marca como leídos los mensajes del usuario
  (actualiza `last_read_at` en la misma transacción) y devuelve en
  `unread_count` los no-leídos **al momento de abrir** el chat.

---

## 3. Archivos creados

### 3.1 `src/database/migrations/20260807000000_add_chat_participants_and_dedup.js`
Migración (aplicada) que:
1. Crea `chat_participants` con PK compuesta `(chat_id, user_id)`,
   `last_read_at`, `deleted_at`, `created_at`, FKs a `chats` y `users`
   (CASCADE) e índice por `user_id`.
2. Canonicaliza pares existentes en `chats` (`user_id_1 = LEAST`, `user_id_2 = GREATEST`).
3. Elimina chats duplicados en ambos sentidos (conserva el de menor `id`).
4. Agrega el índice `UNIQUE (user_id_1, user_id_2)`.
5. Hace backfill de `chat_participants` desde los `chats` existentes
   (`INSERT ... ON CONFLICT DO NOTHING`).

`down()` elimina la tabla y el índice único.

### 3.2 `src/services/ChatService.js`
Clase con toda la lógica de negocio (instancia singleton exportada):
- `canonicalPair(a, b)`: ordena los IDs (canónico).
- `reactivateParticipant(chatId, userId)`: upsert de participación con
  `deleted_at = null` (reactiva soft deletes).
- `createChat(userId, data)`: valida que no sea consigo mismo (`SAME_USER`) y
  que ambos usuarios existan (`USER_NOT_FOUND`); busca el chat existente;
  si no existe, lo crea en transacción (chat + 2 participaciones) y maneja la
  colisión de concurrencia `23505`.
- `listChats(userId, { limit, offset })`: lista con join a participantes,
  perfil del otro usuario (`worker_profiles`/`client_profiles`), último mensaje
  vía `LEFT JOIN LATERAL`, `unread_count` por subquery, orden por
  `last_message_at DESC`, `limit` clampado 1–100 (default 20).
- `getChat(chatId, userId)`: transacción que verifica participación activa
  (404 `CHAT_NOT_FOUND` si no), trae últimos 50 mensajes (orden ascendente en
  la respuesta), calcula `unread_count` y actualiza `last_read_at`.
- `deleteChat(chatId, userId)`: soft delete de la participación + log de auditoría.

### 3.3 `src/controllers/ChatController.js`
- `create`: valida con `createChatSchema`, mapea errores de servicio
  (`404 USER_NOT_FOUND`, `400 SAME_USER`), responde `201`/`200`.
- `list`: verifica que `req.user.user_id === :id` (403 si no), valida query,
  responde `200` con `{ chats, count, limit, offset }`.
- `getById`: responde `200` con `{ chat, messages, unread_count }` o
  `404 CHAT_NOT_FOUND`.
- `remove`: responde `200` o `404 CHAT_NOT_FOUND`.

Todos los errores usan el formato estandarizado
`{ error, message, statusCode, timestamp }`.

### 3.4 `src/routes/chatRoutes.js`
```
POST   /                 → chatController.create   (authenticateToken)
GET    /:chat_id         → chatController.getById  (authenticateToken)
DELETE /:chat_id         → chatController.remove   (authenticateToken)
```

### 3.5 `tests/chat.test.js`
Suite de tests unitarios con mocks de `db` (`jest.unstable_mockModule`) que
cubre: canonicalización, creación/dedup/race `23505`, reactivación, listado
(paginación, filtros, formato, 403), detalle (marcado de leído, unread, 404) y
soft delete.

---

## 4. Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/app.js` | Import de `chatRoutes` y montaje en `/api/v1/chats` (línea 42). |
| `src/routes/userRoutes.js` | Ruta `GET /:id/chats` (antes de `/:id` genérico) + import de `ChatController`. |
| `src/utils/validation.js` | `createChatSchema` (`user_id_2` UUID requerido, `order_id` UUID opcional/nullable) y `listChatsQuerySchema` (`limit` default 20 máx 100, `offset` default 0). |
| `src/utils/swagger.js` | Schemas (`CreateChatRequest`, `CreateChatResponse`, `ChatListItem`, `ChatDetailResponse`, `ListChatsResponse`, `MessageResponse`, errores) y paths `/chats`, `/chats/{chat_id}`, `/users/{id}/chats` vía bloques `@openapi`. |
| `README.md` | Nueva sección de endpoints "Chats (`/api/v1/chats`)". |
| `docs/DATABASE_SCHEMA.md` | Diagrama ER actualizado, tabla `chat_participants`, notas del índice UNIQUE y sección "Sistema de Chats (Issue #4)". |

---

## 5. Flujo de creación (resumen)

```
POST /chats  { user_id_2: uuid, order_id?: uuid }  (JWT)
  1. Validación Joi + verificación user_id_2 != req.user.user_id
  2. Canonicalización: user_id_1 = MIN, user_id_2 = MAX
  3. ¿Existe (user_id_1, user_id_2)? → 200 { chat_id, created: false } (+ reactiva participación)
  4. No existe → transacción: INSERT chats + INSERT 2 chat_participants → 201 { chat_id, created: true }
  5. ¿23505 por concurrencia? → re-consulta y devuelve el chat existente
```

---

## 6. Verificación ejecutada

| Verificación | Resultado |
|---|---|
| `npm run format:check` | ✅ "All matched files use Prettier code style!" |
| `npm test` | ✅ 9 suites, **186/186 tests** (incluye `tests/chat.test.js`) |
| Migración aplicada | ✅ Registrada en `knex_migrations`; tablas `chat_participants` e índice `UNIQUE (user_id_1, user_id_2)` confirmados con `\d chats` y `\d chat_participants` |
| Unicidad a nivel BD | ✅ Insert duplicado directo lanza `23505 duplicate key` (probado con `psql` y con knex) |
| Suite E2E real (script en `/tmp/opencode/e2e-chat.mjs`, DB real `ondemand_db`) | ✅ **23/23 checks**: creación 201, dedup 200 mismo `chat_id`, listado con `unread_count` y último mensaje, detalle + marcado de leído, soft delete (oculto para A, visible para B, 404 para A), reactivación, 403 de otro usuario, 400 SAME_USER |

### 6.1 E2E — puntos clave verificados
- `unread_count` de `GET /chats/:chat_id` = no-leídos al momento de abrir (1);
  el listado posterior muestra 0 para quien leyó.
- Los mensajes enviados por B no cuentan como no leídos para B.
- El fallo inicial del check del `UNIQUE` fue un artefacto: reproducido de forma
  aislada (knex y `psql`) siempre lanza `23505`.

---

## 7. Notas operativas

- Para levantar la BD local: `docker start ondemand_db` (PostGIS en
  `127.0.0.1:5432`, db `ondemand_db`, user/pass `postgres`/`postgres_secure_password`).
- Para probar la API en local (sin `.env`):
  ```bash
  DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=postgres \
  DB_PASSWORD=postgres_secure_password DB_NAME=ondemand_db \
  JWT_SECRET=dev_secret_123 REFRESH_TOKEN_SECRET=dev_secret_123 npm run dev
  ```
- Swagger: `GET /api/v1/api-docs` (los paths de chats están documentados).
- Archivos temporales de pruebas (`e2e-chat.tmp.mjs`) fueron eliminados al finalizar.

---

## 8. Mensajería y WebSocket (Issue #27)

Amplía el sistema de chats con mensajes real-time: envío, listado paginado,
eliminación (soft delete) y notificaciones por WebSocket.

### 8.1 Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/v1/chats/:chat_id/messages` | JWT | Enviar mensaje (`message_type` `TEXT`/`IMAGE`/`QUOTE`; `content` ≤5000 para TEXT/QUOTE; `file` multipart JPG/PNG ≤5MB para IMAGE). `201` → `{ message }`. Emite `message:new`. |
| `GET` | `/api/v1/chats/:chat_id/messages` | JWT | Listar mensajes (`?limit=&offset=`; default 50, máx 100). Excluye borrados; más recientes al final. Marca como leído. |
| `DELETE` | `/api/v1/messages/:message_id` | JWT | Eliminar (solo autor). `403 FORBIDDEN`, `404 MESSAGE_NOT_FOUND`. Emite `message:deleted`. |

### 8.2 WebSocket hub (`src/utils/websocket.js`)

- `WebSocketServer({ server, path: '/ws' })` montado en `server.js` con el mismo HTTP server.
- Auth: access token en `?token=` del handshake (los WebSocket nativos no envían headers);
  token inválido → cierre `1008`.
- `clients: Map<user_id, Set<socket>>` permite múltiples dispositivos por usuario.
- Al autenticarse se envía `{ event: 'connected', payload: { user_id } }`.
- `user:typing` del cliente → verifica participación activa en `chat_participants` y
  reenvía `{ event: 'user:typing', payload: { chat_id, user_id, is_typing } }` a los demás.

### 8.3 Mensajes (`src/services/MessageService.js`)

- `createMessage`: valida participación activa (`404 CHAT_NOT_FOUND`); para `IMAGE` comprime
  con `sharp` (máx 1600px, JPEG q80, `uploads/messages/`); inserta en transacción +
  `chats.last_message_at = now()`; si la transacción falla, elimina el archivo del disco;
  emite `message:new` a los demás participantes; log `[AUDITORIA]`.
- `listMessages`: solo mensajes con `deleted_at IS NULL`, orden `created_at DESC, id DESC` +
  `reverse()` (más recientes al final); actualiza `last_read_at`.
- `deleteMessage`: verifica existencia (`404`), autoría (`403`), soft delete + emite
  `message:deleted`.

### 8.4 Imágenes

- `src/middlewares/upload.js`: multer memoryStorage, 5MB, fileFilter JPG/PNG
  (`INVALID_FILE_TYPE`). `handleUploadError` traduce errores de multer a `400 UPLOAD_ERROR`
  (ocurren en el middleware, antes del controller).
- `src/services/ImageService.js`: `compressAndStoreImage` (valida, redimensiona, comprime,
  guarda con UUID) y `deleteStoredFile`.
- `src/app.js`: `express.static` en `/uploads` + `.env.example` `UPLOAD_DIR=uploads` +
  `.gitignore` `uploads/`.

### 8.5 Migraciones nuevas

- `20260808000000_add_message_soft_delete.js`: `messages.deleted_at` + índice compuesto
  `(chat_id, created_at DESC)`.
- `20260808010000_messages_content_nullable.js`: `messages.content` pasa a `NULLABLE`
  (mensajes solo-imagen). Requerida porque `content` era `NOT NULL` en el schema inicial.

### 8.6 Verificación

| Verificación | Resultado |
|---|---|
| `npm run format:check` | ✅ "All matched files use Prettier code style!" |
| `npm test` | ✅ 12 suites, **224/224 tests** (38 nuevos: `messageService`, `messageController`, `websocket`) |
| Swagger | ✅ `GET /api/v1/api-docs` compila; incluye paths `/chats/{chat_id}/messages`, `/messages/{message_id}`, `/ws` y schemas de mensajes |
| Suite E2E real (DB `ondemand_db`) | ✅ **26/26 checks**: TEXT 201, IMAGE 201 + redimensión a 1600px y compresión, QUOTE/validación 400, multipart inválido y >5MB → 400, listado paginado, marca de leído, DELETE autor 200 / no-autor 403, WS `connected`/`message:new`/`user:typing`/`message:deleted`, WS sin token rechazado con `1008`, acceso 404 fuera del chat |

**Bugs detectados por E2E y corregidos:** mensajes IMAGE fallaban con 500
(`content NOT NULL`) → migración `content_nullable`; errores de multer (tipo inválido y
>5MB) llegaban al error handler central como 500 → nuevo middleware `handleUploadError`
que responde `400 UPLOAD_ERROR`.
