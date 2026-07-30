# Esquema de Base de Datos - Digital On-Demand Platform

Este documento detalla el esquema de base de datos relacional implementado en PostgreSQL para soportar la plataforma. Incluye geolocalización avanzada (PostGIS) y una estructura optimizada para el **Modelo de Rol Dual**, **Transacciones con Escrow** y **Autenticación con JWT y OTP en dos pasos**.

---

## 🗺️ Diagrama de Relaciones de Entidad (Resumen)

- `users` (1) ── (1) `client_profiles`
- `users` (1) ── (1) `worker_profiles`
- `users` (1) ── (N) `locations`
- `users` (1) ── (N) `payment_methods`
- `users` (1) ── (N) `refresh_tokens` _(autenticación JWT)_
- `worker_profiles` (1) ── (N) `certifications`
- `client_profiles` (1) ── (N) `orders` (como solicitante)
- `worker_profiles` (1) ── (N) `orders` (como proveedor)
- `categories` (1) ── (N) `orders`
- `locations` (1) ── (N) `orders`
- `orders` (1) ── (N) `quotes`
- `orders` (1) ── (1) `chats` ── (N) `messages`
- `orders` (1) ── (N) `transactions` (Escrow / Pagos)
- `orders` (1) ── (N) `ratings`
- `orders` (1) ── (N) `disputes`

---

## 🗂️ Tablas Core

### 1. `users`
Almacena las credenciales globales del usuario. El mismo usuario puede actuar como cliente o proveedor mediante perfiles asociados.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único autogenerado. |
| `email` | `VARCHAR` | `UNIQUE`, `NOT NULL` | Correo electrónico principal. |
| `phone` | `VARCHAR` | `UNIQUE`, `NOT NULL` | Teléfono de contacto. |
| `password_hash` | `VARCHAR` | `NOT NULL` | Contraseña cifrada con bcrypt (12 rondas). |
| `verified_email`| `BOOLEAN` | `DEFAULT false` | Indicador de email verificado. |
| `verified_phone`| `BOOLEAN` | `DEFAULT false` | Indicador de teléfono verificado. |
| `active` | `BOOLEAN` | `DEFAULT true` | Estado de la cuenta. |
| `otp_code` | `VARCHAR` | `NULLABLE` | Código OTP de 6 dígitos activo. Se borra tras verificación exitosa. |
| `otp_expires_at`| `TIMESTAMP` | `NULLABLE` | Expiración del OTP (10 minutos desde su generación). |
| `is_verified` | `BOOLEAN` | `DEFAULT false` | `true` tras verificar el primer OTP. |
| `current_role` | `VARCHAR` | `DEFAULT 'client'` | Rol activo en sesión: `client` o `worker`. Incluido en el payload JWT. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de creación del registro. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Fecha de última modificación. |

*   **Índices**: B-Tree en `created_at`.
*   **Agregado en**: Migración `20260724000000_add_auth_fields_and_refresh_tokens.js` (campos `otp_code`, `otp_expires_at`, `is_verified`, `current_role`).

---

### 1b. `refresh_tokens`
Almacena los refresh tokens activos para implementar rotación segura de tokens JWT. Cada token tiene un identificador único (`jti`) que permite revocación individual sin invalidar toda la sesión.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único autogenerado. |
| `user_id` | `UUID` | `FOREIGN KEY` (Cascade) | Usuario propietario del token. |
| `jti` | `VARCHAR` | `UNIQUE`, `NOT NULL` | JWT ID único (UUID v4). Permite revocación individual. |
| `expires_at` | `TIMESTAMP` | `NOT NULL` | Fecha de expiración del token (7 días). |
| `created_at` | `TIMESTAMP` | `DEFAULT Now()` | Fecha de emisión. |

*   **Índices**: B-Tree en `user_id`, `jti`.
*   **Cascade DELETE**: Al eliminar un usuario, todos sus refresh tokens se eliminan automáticamente.
*   **Rotación**: Cada uso de `POST /auth/refresh-token` revoca el token actual y emite uno nuevo.
*   **Agregado en**: Migración `20260724000000_add_auth_fields_and_refresh_tokens.js`.

---

### 2. `categories`
Catálogo de categorías de servicios disponibles (ej. Plomería, Limpieza).

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `name` | `VARCHAR` | `UNIQUE`, `NOT NULL` | Nombre de la categoría. |
| `description` | `TEXT` | - | Detalle de los servicios cubiertos. |
| `icon_url` | `VARCHAR` | - | Icono representativo de la categoría. |
| `active` | `BOOLEAN` | `DEFAULT true` | Si la categoría está disponible para uso. |

---

### 3. `locations`
Direcciones geográficas asociadas a los usuarios mediante coordenadas espaciales (PostGIS).

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `user_id` | `UUID` | `FOREIGN KEY` (Cascade) | Usuario propietario de la dirección. |
| `address` | `VARCHAR` | `NOT NULL` | Dirección formateada en texto plano. |
| `latitude` | `DOUBLE` | `NOT NULL` | Latitud decimal. |
| `longitude` | `DOUBLE` | `NOT NULL` | Longitud decimal. |
| `geography` | `GEOGRAPHY(Point, 4326)` | `NOT NULL` | Punto geográfico PostGIS indexado. |
| `is_primary` | `BOOLEAN` | `DEFAULT false` | Si es la dirección principal. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de creación del registro. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Fecha de última modificación. |

*   **Índices**:
    *   B-Tree en `user_id`, `created_at`.
    *   **GiST** en la columna `geography` (optimización espacial para cálculos de distancia/cercanía).

---

### 4. `client_profiles`
Información detallada para usuarios cuando actúan en rol de **Cliente**.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `user_id` | `UUID` | `FOREIGN KEY` (Cascade), `UNIQUE` | Enlace al usuario global. |
| `full_name` | `VARCHAR` | `NOT NULL` | Nombre completo expuesto en el perfil. |
| `avatar_url` | `VARCHAR` | - | Enlace a la imagen de avatar. |
| `bio` | `TEXT` | - | Presentación breve del cliente. |
| `default_location_id` | `UUID` | `FOREIGN KEY` (Set Null) | Ubicación predeterminada para órdenes. |
| `preferences` | `JSONB` | - | Preferencias del cliente (notificaciones, idioma, tema, etc.). Agregado en migración `20260730000000_add_client_preferences.js`. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de creación. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última actualización. |

---

### 5. `worker_profiles`
Información detallada para usuarios cuando actúan en rol de **Proveedor (Trabajador)**.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `user_id` | `UUID` | `FOREIGN KEY` (Cascade), `UNIQUE` | Enlace al usuario global. |
| `full_name` | `VARCHAR` | `NOT NULL` | Nombre comercial/completo del proveedor. |
| `avatar_url` | `VARCHAR` | - | Enlace a la imagen del perfil. |
| `bio` | `TEXT` | - | Experiencia y presentación. |
| `category_id` | `UUID` | `FOREIGN KEY` (Set Null) | Categoría principal de especialidad. |
| `hourly_rate` | `DECIMAL(10,2)`| `NOT NULL` | Tarifa sugerida por hora de trabajo. |
| `availability_status` | `VARCHAR` | `DEFAULT 'AVAILABLE'` | Estados: `AVAILABLE`, `BUSY`, `OFFLINE`. |
| `certification_status`| `VARCHAR` | `DEFAULT 'PENDING'` | Estados de validación: `PENDING`, `APPROVED`, `REJECTED`. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de creación. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última actualización. |

---

### 6. `certifications`
Documentos oficiales subidos por el proveedor para validar su perfil.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `worker_id` | `UUID` | `FOREIGN KEY` (Cascade) | Enlace al perfil de proveedor. |
| `document_type` | `VARCHAR` | `NOT NULL` | Tipo: `ID`, `LICENSE`, `CERTIFICATE`, `BACKGROUND_CHECK`. |
| `document_url` | `VARCHAR` | `NOT NULL` | Archivo digitalizado alojado. |
| `verification_status` | `VARCHAR` | `DEFAULT 'PENDING'` | Estados: `PENDING`, `APPROVED`, `REJECTED`. |
| `approved_at` | `TIMESTAMP` | - | Fecha de aprobación/auditoría. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de subida. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última actualización. |

---

### 7. `payment_methods`
Métodos de pago registrados por los clientes.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `user_id` | `UUID` | `FOREIGN KEY` (Cascade) | Enlace al dueño del método. |
| `card_number_masked` | `VARCHAR` | `NOT NULL` | Tarjeta enmascarada (ej. `**** **** **** 1234`). |
| `card_brand` | `VARCHAR` | `NOT NULL` | Franquicia (ej: `Visa`, `MasterCard`). |
| `exp_month` | `INTEGER` | `NOT NULL` | Mes de expiración. |
| `exp_year` | `INTEGER` | `NOT NULL` | Año de expiración. |
| `is_primary` | `BOOLEAN` | `DEFAULT false` | Método de pago prioritario. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de creación. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última actualización. |

---

### 8. `orders`
Representa el contrato/orden de servicio pactada entre un cliente y un proveedor.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `client_id` | `UUID` | `FOREIGN KEY` (Restrict) | Cliente que solicita el servicio. |
| `worker_id` | `UUID` | `FOREIGN KEY` (Restrict) | Proveedor asignado. |
| `category_id` | `UUID` | `FOREIGN KEY` (Restrict) | Categoría del trabajo solicitado. |
| `location_id` | `UUID` | `FOREIGN KEY` (Restrict) | Dirección pactada de entrega. |
| `status` | `VARCHAR` | `DEFAULT 'PENDING'` | Estados: `PENDING`, `ACCEPTED`, `REJECTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de creación. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última actualización. |

---

### 9. `quotes`
Propuesta de tarifa y agenda enviada por el proveedor ante una solicitud o negociación de orden.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `order_id` | `UUID` | `FOREIGN KEY` (Cascade) | Orden relacionada. |
| `proposed_price` | `DECIMAL(10,2)`| `NOT NULL` | Precio total de la propuesta. |
| `proposed_date` | `DATE` | `NOT NULL` | Fecha estimada del servicio. |
| `proposed_time` | `TIME` | `NOT NULL` | Hora estimada. |
| `status` | `VARCHAR` | `DEFAULT 'PENDING'` | Estados de la cotización: `PENDING`, `ACCEPTED`, `REJECTED`. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de envío. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última actualización. |

---

### 10. `chats`
Canal de mensajería asociado a una orden/negociación.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `user_id_1` | `UUID` | `FOREIGN KEY` (Cascade) | ID del participante 1. |
| `user_id_2` | `UUID` | `FOREIGN KEY` (Cascade) | ID del participante 2. |
| `order_id` | `UUID` | `FOREIGN KEY` (Set Null) | Orden asociada (opcional). |
| `last_message_at`| `TIMESTAMP` | `DEFAULT Now()` | Timestamp del último mensaje enviado. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Creación del chat. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última actualización. |

---

### 11. `messages`
Mensajes individuales dentro de un chat.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `chat_id` | `UUID` | `FOREIGN KEY` (Cascade) | Chat al que pertenece. |
| `sender_id` | `UUID` | `FOREIGN KEY` (Cascade) | Usuario emisor del mensaje. |
| `content` | `TEXT` | `NOT NULL` | Contenido del mensaje. |
| `message_type` | `VARCHAR` | `DEFAULT 'TEXT'` | Tipos: `TEXT`, `IMAGE`, `QUOTE` (Cotizaciones compartidas). |
| `attachment_url` | `VARCHAR` | - | Enlace a imágenes/documentos adjuntos. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha y hora de envío. |

---

### 12. `transactions`
Registros financieros con soporte para **Escrow**.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `order_id` | `UUID` | `FOREIGN KEY` (Restrict) | Orden correspondiente. |
| `payer_id` | `UUID` | `FOREIGN KEY` (Restrict) | Usuario emisor del pago (Cliente). |
| `receiver_id` | `UUID` | `FOREIGN KEY` (Restrict) | Usuario receptor final (Proveedor). |
| `amount` | `DECIMAL(10,2)`| `NOT NULL` | Monto bruto. |
| `status` | `VARCHAR` | `DEFAULT 'PENDING'` | Estados: `PENDING`, `ESCROWED` (retenido en garantía), `COMPLETED` (liberado), `REFUNDED` (devuelto al cliente). |
| `payment_method_id`| `UUID` | `FOREIGN KEY` (Set Null) | Método de pago utilizado. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de transacción. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última actualización. |

---

### 13. `ratings`
Calificaciones del servicio tras su culminación.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `order_id` | `UUID` | `FOREIGN KEY` (Cascade) | Orden calificada. |
| `rater_id` | `UUID` | `FOREIGN KEY` (Cascade) | Usuario evaluador. |
| `ratee_id` | `UUID` | `FOREIGN KEY` (Cascade) | Usuario calificado. |
| `rating_stars` | `INTEGER` | `NOT NULL` | Estrellas asignadas (1 a 5). |
| `review_text` | `TEXT` | - | Comentarios escritos del servicio. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de calificación. |

---

### 14. `disputes`
Mediaciones abiertas en caso de inconformidad o problemas en la entrega de un servicio.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único. |
| `order_id` | `UUID` | `FOREIGN KEY` (Restrict) | Orden en conflicto. |
| `opened_by_id` | `UUID` | `FOREIGN KEY` (Restrict) | Usuario que abre la disputa. |
| `reason` | `TEXT` | `NOT NULL` | Descripción de la queja. |
| `evidence_url` | `VARCHAR` | - | URL de soporte (capturas de pantalla, archivos). |
| `status` | `VARCHAR` | `DEFAULT 'OPEN'` | Estados: `OPEN`, `RESOLVED`, `CLOSED`. |
| `resolution_notes` | `TEXT` | - | Notas del mediador/resolución final. |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de apertura. |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última actualización. |

---

## 🔐 Sistema de Autenticación (Issue #5)

Documenta la implementación completa del sistema de autenticación JWT con verificación OTP en dos pasos.

### Flujo de Registro

```
1. POST /api/v1/auth/register  { email, phone, password }
        ↓  Valida formato (Joi) + verifica unicidad en BD
        ↓  Crea usuario con password_hash (bcrypt, 10 rondas)
        ↓  Genera OTP (6 dígitos aleatorios, expira 10 min)
        ↓  Guarda OTP en users.otp_code / otp_expires_at
        ↓  Envía OTP por Email y SMS (NotificationProvider)
   ← 201 { user: { id, email, phone } }

2. POST /api/v1/auth/verify-otp  { email, otp_code }
        ↓  Valida OTP vs. users.otp_code + otp_expires_at
        ↓  Limpia otp_code, otp_expires_at → is_verified = true
        ↓  Genera accessToken (JWT, 1h) + refreshToken (JWT, 7d)
        ↓  Almacena refreshToken.jti en tabla refresh_tokens
   ← 200 { accessToken, refreshToken, user }
```

### Flujo de Login

```
1. POST /api/v1/auth/login  { email | phone, password }
        ↓  Busca usuario por email o phone
        ↓  Compara password con password_hash (bcrypt.compare)
        ↓  Genera y envía OTP (mismo mecanismo que registro)
   ← 200 { status: 'PENDING_VERIFICATION', user: { id, email } }

2. POST /api/v1/auth/verify-otp  { email, otp_code }
        ↓  (mismo flujo que en registro)
   ← 200 { accessToken, refreshToken, user }
```

### Renovación de Token

```
POST /api/v1/auth/refresh-token  { refreshToken }
        ↓  Verifica firma JWT (REFRESH_TOKEN_SECRET)
        ↓  Valida jti en tabla refresh_tokens + expiración
        ↓  Revoca token actual (DELETE de refresh_tokens por jti)
        ↓  Genera nuevo accessToken + nuevo refreshToken
   ← 200 { accessToken, refreshToken }
```

### Estructura de los Tokens JWT

#### Access Token (exp: 1 hora)
```json
{
  "user_id": "uuid-del-usuario",
  "email": "usuario@example.com",
  "current_role": "client",
  "iat": 1234567890,
  "exp": 1234571490
}
```

#### Refresh Token (exp: 7 días)
```json
{
  "user_id": "uuid-del-usuario",
  "jti": "uuid-v4-único",
  "iat": 1234567890,
  "exp": 1235172690
}
```

### Middlewares

| Middleware | Archivo | Descripción |
|---|---|---|
| `authenticateToken` | `src/middlewares/authMiddleware.js` | Valida JWT en header `Authorization: Bearer <token>`. Inyecta `req.user` con el payload decodificado. |
| `requireRole(roles)` | `src/middlewares/authMiddleware.js` | Verifica que `req.user.current_role` esté en la lista de roles permitidos. Los roles `worker` y `provider` son equivalentes. |
| `authRateLimiter` | `src/middlewares/rateLimiter.js` | Limita a **5 requests por IP cada 15 minutos** en todos los endpoints `/auth/*`. Responde `429` al superarse. |

### Validación de contraseña

```
Regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[símbolos]).{8,}$/

✅ Válida:   P@ssword123!
❌ Inválida: password123   (sin mayúscula ni símbolo)
❌ Inválida: Pass1!        (menos de 8 caracteres)
```

### Servicios implementados

| Servicio | Archivo | Responsabilidad |
|---|---|---|
| `AuthService` | `src/services/AuthService.js` | Generación/verificación de JWT access tokens y refresh tokens con rotación. |
| `OtpService` | `src/services/OtpService.js` | Generación, almacenamiento y validación de OTP. Delega el envío a `NotificationProvider`. |
| `NotificationProvider` | `src/services/OtpService.js` | Abstracción de envío de notificaciones. Simulación actual; preparada para Twilio (SMS) y SendGrid (Email). |

---

## 🙋 Sistema de Perfiles de Cliente (Issue #8)

Implementa endpoints específicos para gestionar el perfil de cliente (`client_profiles`), incluyendo ubicación por defecto y preferencias en JSON.

### Flujo de Gestión de Perfil de Cliente

```
GET /users/:id/client-profile  (requiere JWT, solo propio usuario)
        ↓  Valida autorización (req.user.user_id === req.params.id)
        ↓  Busca en client_profiles por user_id
   ← 200 { id, user_id, full_name, avatar_url, bio, default_location_id, preferences, created_at, updated_at }
   ← 404 { error: 'CLIENT_PROFILE_NOT_FOUND' }  (si no existe)

POST /users/:id/client-profile  (requiere JWT, solo propio usuario)
        ↓  Valida autorización + body (Joi)
        ↓  Verifica que no exista perfil previo
        ↓  Inserta fila en client_profiles
   ← 201 { message, profile }
   ← 409 { error: 'CLIENT_PROFILE_EXISTS' }  (si ya existe)

PATCH /users/:id/client-profile  (requiere JWT, solo propio usuario)
        ↓  Valida autorización + body (todos los campos opcionales)
        ↓  Actualiza solo los campos enviados
        ↓  Log de auditoría
   ← 200 { message, profile }
   ← 404 { error: 'CLIENT_PROFILE_NOT_FOUND' }  (si no existe)
```

### Validaciones
- `full_name`: obligatorio en POST, opcional en PATCH, 1-100 caracteres
- `avatar_url`: opcional, solo URL jpg/jpeg/png
- `bio`: opcional, máximo 500 caracteres
- `default_location_id`: opcional, debe ser UUID válido
- `preferences`: opcional, objeto JSON

### Servicios implementados

| Servicio | Archivo | Responsabilidad |
|---|---|---|
| `ClientProfileService` | `src/services/ClientProfileService.js` | CRUD de perfil de cliente con upsert y log de auditoría |

## 👤 Sistema de Perfiles de Usuario (Issue #7)

Implementa endpoints para obtener y actualizar datos de perfil. Los perfiles se almacenan en las tablas `client_profiles` y `worker_profiles`, y el endpoint selecciona la tabla según el `current_role` del JWT.

### Flujo de Consulta de Perfil

```
GET /api/v1/users/:id  (público — sin autenticación)
        ↓  Busca usuario activo en tabla users
        ↓  Obtiene perfil de client_profiles o worker_profiles
        ↓  Calcula average_rating desde tabla ratings
   ← 200 { id, full_name, avatar_url, bio, average_rating, role }

GET /api/v1/users/me  (privado — requiere JWT)
        ↓  Busca usuario completo en tabla users
        ↓  Obtiene AMBOS perfiles (client + worker) si existen
        ↓  Calcula average_rating desde tabla ratings
   ← 200 { id, email, phone, current_role, is_verified, ...,
           profile: { client: {...}, worker: {...} } }
```

### Flujo de Actualización de Perfil

```
PATCH /api/v1/users/:id  (requiere JWT, solo propio usuario)
        ↓  Valida: req.user.user_id === req.params.id
        ↓  Valida body con Joi: full_name (1-100), avatar_url (jpg/png), bio (≤500)
        ↓  Selecciona tabla según current_role ('client' → client_profiles, 'worker' → worker_profiles)
        ↓  Crea o actualiza el registro existente
        ↓  Log de auditoría con Winston
   ← 200 { message, profile: { id, full_name, avatar_url, bio, updated_at } }
```

### Validaciones
- `full_name`: obligatorio, 1-100 caracteres
- `avatar_url`: opcional, solo URL con extensión `.jpg`/`.jpeg`/`.png`
- `bio`: opcional, máximo 500 caracteres
- Autorización: `403` si el `user_id` del JWT no coincide con `:id`

### Auditoría
Cada actualización genera un log estructurado:

```
[AUDITORIA] Perfil de usuario actualizado
  user_id: "uuid", role: "client", profile_id: "uuid",
  changes: { full_name: "...", avatar_url: "...", bio_length: 150 },
  timestamp: "2026-07-30T..."
```

### Servicios implementados

| Servicio | Archivo | Responsabilidad |
|---|---|---|
| `UserService` | `src/services/UserService.js` | Consulta de perfil público/privado, actualización con upsert, cálculo de rating promedio |

### Documentación de la API

Swagger UI disponible en: `http://localhost:3000/api/v1/api-docs`

| Endpoint | Auth | Códigos de respuesta |
|---|---|---|
| `GET /users/:id` | No | `200`, `404` |
| `GET /users/me` | JWT | `200`, `401`, `403`, `404` |
| `PATCH /users/:id` | JWT | `200`, `400` (validación), `401`, `403`, `404` |
