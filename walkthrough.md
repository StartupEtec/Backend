# Walkthrough - Implementación del Backend

## Issue #5: Sistema de Autenticación con JWT, Refresh Tokens y OTP (2FA)

Se ha completado el desarrollo del sistema de autenticación seguro, modular y listo para producción según los criterios de aceptación y directrices de arquitectura.

### Cambios Realizados

A continuación se detalla la lista de archivos creados y modificados:

- **Configuración y Dependencias**:
  - [package.json](file:///home/thiagox/Documentos/Backend/package.json): Se añadieron dependencias para encriptación (`bcrypt`), tokens (`jsonwebtoken`), IDs únicos (`uuid`), rate limiting (`express-rate-limit`) y documentación de API (`swagger-jsdoc` y `swagger-ui-express`).
  - [.env.example](file:///home/thiagox/Documentos/Backend/.env.example): Se documentaron variables para `JWT_SECRET` y `REFRESH_TOKEN_SECRET`.

- **Base de Datos**:
  - [20260724000000_add_auth_fields_and_refresh_tokens.js](file:///home/thiagox/Documentos/Backend/src/database/migrations/20260724000000_add_auth_fields_and_refresh_tokens.js): Migración para añadir campos `otp_code`, `otp_expires_at` y `is_verified` a `users` y crear la tabla `refresh_tokens`.
  - [db.js](file:///home/thiagox/Documentos/Backend/src/database/db.js): Módulo de inicialización de la conexión de Knex para el backend.

- **Servicios y Utilidades**:
  - [logger.js](file:///home/thiagox/Documentos/Backend/src/utils/logger.js): Logger estructurado con Winston para control de auditoría de intentos fallidos sin exponer credenciales ni OTPs.
  - [validation.js](file:///home/thiagox/Documentos/Backend/src/utils/validation.js): Validación con Joi para registro (contraseña robusta), inicio de sesión, verificación de OTP y rotación de tokens.
  - [OtpService.js](file:///home/thiagox/Documentos/Backend/src/services/OtpService.js): Generación, guardado en BD, verificación de expiración (10 min) y simulación de envío (vía logs).
  - [AuthService.js](file:///home/thiagox/Documentos/Backend/src/services/AuthService.js): Creación de JWT de acceso (expira en 1h) y Refresh Token seguro con rotación automática almacenados en la BD (expira en 7 días).

- **Controladores, Rutas y Middlewares**:
  - [AuthController.js](file:///home/thiagox/Documentos/Backend/src/controllers/AuthController.js): Lógica de control para `/register`, `/login`, `/verify-otp`, `/refresh-token`.
  - [authRoutes.js](file:///home/thiagox/Documentos/Backend/src/routes/authRoutes.js): Enrutador con middleware de rate limiting asignado.
  - [authMiddleware.js](file:///home/thiagox/Documentos/Backend/src/middlewares/authMiddleware.js): Middleware `authenticateToken` para autorizar peticiones por JWT y `requireRole` para control de roles (cliente/trabajador).
  - [rateLimiter.js](file:///home/thiagox/Documentos/Backend/src/middlewares/rateLimiter.js): Limitador de tasa asignado de 5 peticiones por IP en 15 minutos en rutas `/auth/*`.

- **Documentación e Integración**:
  - [app.js](file:///home/thiagox/Documentos/Backend/src/app.js): Registro de las rutas de autenticación y setup de Swagger.
  - [swagger.js](file:///home/thiagox/Documentos/Backend/src/utils/swagger.js): Especificaciones OpenAPI del flujo de autenticación.

- **Pruebas**:
  - [auth.test.js](file:///home/thiagox/Documentos/Backend/tests/auth.test.js): Suite de pruebas unitarias para hashing, tokens, OTP y middlewares.

---

## Issue #8: Endpoints de Perfil de Cliente (GET, POST, PATCH)

Se ha completado el desarrollo de los endpoints específicos para gestionar el perfil de cliente (`client_profiles`), con creación, consulta y actualización de datos incluyendo ubicación por defecto y preferencias.

### Cambios Realizados

Archivos creados:

- [ClientProfileService.js](file:///home/thiagox/Documentos/Backend/src/services/ClientProfileService.js): Servicio con 3 métodos:
  - `getProfile(userId)`: retorna el perfil de cliente completo
  - `createProfile(userId, data)`: crea un nuevo perfil (retorna null si ya existe)
  - `updateProfile(userId, data)`: actualiza campos específicos del perfil (retorna null si no existe)

- [ClientProfileController.js](file:///home/thiagox/Documentos/Backend/src/controllers/ClientProfileController.js): Controlador con 3 métodos:
  - `getProfile`: maneja `GET /users/:id/client-profile`
  - `createProfile`: maneja `POST /users/:id/client-profile`
  - `updateProfile`: maneja `PATCH /users/:id/client-profile`

- [20260730000000_add_client_preferences.js](file:///home/thiagox/Documentos/Backend/src/database/migrations/20260730000000_add_client_preferences.js): Migración que agrega columna `preferences` (JSONB) a `client_profiles`

- [clientProfile.test.js](file:///home/thiagox/Documentos/Backend/tests/clientProfile.test.js): 20 tests (servicio, validación Joi, controlador)

Archivos modificados:

- [userRoutes.js](file:///home/thiagox/Documentos/Backend/src/routes/userRoutes.js): Agrega rutas `/:id/client-profile` antes de las rutas genéricas `/:id` para evitar conflictos
- [validation.js](file:///home/thiagox/Documentos/Backend/src/utils/validation.js): Agrega `createClientProfileSchema` y `updateClientProfileSchema`
- [swagger.js](file:///home/thiagox/Documentos/Backend/src/utils/swagger.js): Documenta los 3 endpoints con schemas de request/response

### Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/users/:id/client-profile` | JWT | Obtener perfil de cliente |
| `POST` | `/users/:id/client-profile` | JWT | Crear perfil de cliente (requiere `full_name`) |
| `PATCH` | `/users/:id/client-profile` | JWT | Actualizar perfil de cliente (todos los campos opcionales) |

### Validaciones
- `full_name`: obligatorio en POST, opcional en PATCH, 1-100 caracteres
- `avatar_url`: opcional, solo URL jpg/jpeg/png
- `bio`: opcional, máximo 500 caracteres
- `default_location_id`: opcional, debe ser UUID válido
- `preferences`: opcional, objeto JSON libre
- Autorización: `403` si el `user_id` del JWT no coincide con `:id`

### Base de Datos
- Nueva columna `preferences` (JSONB) en `client_profiles` para almacenar preferencias
- Ejecutar migración: `npx knex migrate:latest`

---

## Issue #7: Endpoints de Perfil de Usuario (GET, PATCH)

Se ha completado el desarrollo de los endpoints para obtener y actualizar datos de perfil de usuario, siguiendo la arquitectura en capas y aplicando autorización, validación y auditoría.

### Cambios Realizados

Archivos creados:

- [UserService.js](file:///home/thiagox/Documentos/Backend/src/services/UserService.js): Servicio con 3 métodos:
  - `getPublicProfile(userId)`: retorna datos públicos (nombre, avatar, bio, rating promedio desde `ratings`)
  - `getPrivateProfile(userId)`: retorna datos privados + ambos perfiles (client/worker)
  - `updateProfile(userId, data, currentRole)`: crea o actualiza el perfil según el rol activo, con log de auditoría

- [UserController.js](file:///home/thiagox/Documentos/Backend/src/controllers/UserController.js): Controlador con 3 métodos:
  - `getUserById`: maneja `GET /users/:id` (público, sin auth)
  - `getMyProfile`: maneja `GET /users/me` (requiere JWT)
  - `updateProfile`: maneja `PATCH /users/:id`, valida que `req.user.user_id === req.params.id`

- [userRoutes.js](file:///home/thiagox/Documentos/Backend/src/routes/userRoutes.js): Rutas montadas en `/api/v1/users`

- [user.test.js](file:///home/thiagox/Documentos/Backend/tests/user.test.js): 16 tests unitarios (servicio, validación Joi, controlador)

Archivos modificados:

- [app.js](file:///home/thiagox/Documentos/Backend/src/app.js): Monta `userRoutes` en `/api/v1/users`
- [validation.js](file:///home/thiagox/Documentos/Backend/src/utils/validation.js): Agrega `updateProfileSchema` con validaciones para `full_name` (obligatorio, 1-100), `avatar_url` (URL jpg/png), `bio` (máx 500)
- [swagger.js](file:///home/thiagox/Documentos/Backend/src/utils/swagger.js): Documenta los 3 endpoints con schemas de request/response

### Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/v1/users/:id` | No | Perfil público (nombre, avatar, bio, rating) |
| `GET` | `/api/v1/users/me` | JWT | Perfil privado (email, teléfono, roles) |
| `PATCH` | `/api/v1/users/:id` | JWT | Actualiza nombre, avatar, bio (solo propio usuario) |

### Validaciones
- `full_name`: obligatorio, 1-100 caracteres
- `avatar_url`: opcional, solo URL jpg/jpeg/png
- `bio`: opcional, máximo 500 caracteres
- Autorización: `403` si el `user_id` del JWT no coincide con `:id`

### Auditoría
Cada actualización de perfil registra en Winston:
```
[AUDITORIA] Perfil de usuario actualizado
  user_id, role, profile_id, changes, timestamp
```

---

## Instrucciones de Ejecución y Verificación

Sigue estos pasos locales para levantar el entorno y comprobar el flujo:

### 1. Construir y Levantar Contenedores

Ejecuta el siguiente comando para reconstruir la imagen Docker de Node.js instalando las nuevas dependencias y levantando la base de datos PostgreSQL:

```bash
sudo docker-compose up --build -d
```

### 2. Ejecutar Migraciones en la Base de Datos

Aplica los cambios en el esquema de base de datos dentro del contenedor:

```bash
sudo docker-compose exec api npm run migrate:latest
```

### 3. Ejecutar Pruebas de Integración y Unitarias

Para verificar que todos los servicios y middlewares funcionen según lo esperado:

```bash
sudo docker-compose exec api npm run test
```

### 4. Pruebas Manuales (Flujo Completo)

#### A. Registrar un usuario
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "thiago@example.com", "phone": "123456789", "password": "Password123!"}'
```
*Revisa los logs del contenedor (`sudo docker-compose logs api`) para ver el código OTP simulado que fue generado.*

#### B. Iniciar sesión (debe retornar `PENDING_VERIFICATION`)
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "thiago@example.com", "password": "Password123!"}'
```

#### C. Verificar OTP (obtiene `accessToken` y `refreshToken`)
```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "thiago@example.com", "otp_code": "CODIGO_DE_LOS_LOGS"}'
```

#### D. Ver perfil público
```bash
curl -X GET http://localhost:3000/api/v1/users/USER_ID
```

#### E. Ver perfil privado (autenticado)
```bash
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

#### F. Actualizar perfil
```bash
curl -X PATCH http://localhost:3000/api/v1/users/USER_ID \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"full_name": "Juan Pérez", "avatar_url": "https://example.com/avatar.jpg", "bio": "Técnico especialista en reparaciones"}'
```

#### G. Acceder a la Documentación Swagger
Visita http://localhost:3000/api/v1/api-docs en tu navegador para ver y probar interactivamente los endpoints mediante Swagger UI.
