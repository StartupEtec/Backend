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

## Issue #21: Endpoints de Ubicaciones (CRUD)

Se ha completado el desarrollo de los endpoints para la gestión de ubicaciones guardadas con geolocalización PostGIS, incluyendo validación de coordenadas, límite por usuario y marcado de ubicación por defecto.

### Cambios Realizados

Archivos creados:

- [LocationService.js](file:///home/thiagox/Documentos/Backend/src/services/LocationService.js): Servicio con 5 métodos:
  - `createLocation(userId, data)`: crea una ubicación, sin superar el máximo de 10 por usuario. La primera se marca como principal automáticamente.
  - `listLocations(userId, referenceLat, referenceLng)`: lista ubicaciones. Si se provee `lat`/`lng`, calcula `distance_m` con `ST_Distance` de PostGIS.
  - `getLocationById(locationId)`: obtiene una ubicación por ID.
  - `updateLocation(locationId, userId, data)`: actualiza dirección, coordenadas y/o `is_primary`. Al marcar como principal, quita el flag a las demás.
  - `deleteLocation(locationId, userId)`: elimina una ubicación (validando propiedad).

- [LocationController.js](file:///home/thiagox/Documentos/Backend/src/controllers/LocationController.js): Controlador con 5 métodos (`create`, `list`, `getById`, `update`, `remove`) que valida autorización por JWT y entradas con Joi.

- [locationRoutes.js](file:///home/thiagox/Documentos/Backend/src/routes/locationRoutes.js): Rutas `GET/PATCH/DELETE /locations/:location_id`, montadas en `/api/v1/locations`.

- [location.test.js](file:///home/thiagox/Documentos/Backend/tests/location.test.js): 21 tests (servicio, validación Joi, controlador).

Archivos modificados:

- [validation.js](file:///home/thiagox/Documentos/Backend/src/utils/validation.js): Agrega `createLocationSchema`, `updateLocationSchema` y `listLocationsQuerySchema`.
- [userRoutes.js](file:///home/thiagox/Documentos/Backend/src/routes/userRoutes.js): Agrega `POST/GET /:id/locations` antes de las rutas genéricas `/:id`.
- [app.js](file:///home/thiagox/Documentos/Backend/src/app.js): Monta `locationRoutes` en `/api/v1/locations`.
- [swagger.js](file:///home/thiagox/Documentos/Backend/src/utils/swagger.js): Documenta los 5 endpoints con schemas de request/response.

### Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/users/:id/locations` | JWT | Crear ubicación (requiere `address`, `latitude`, `longitude`) |
| `GET` | `/users/:id/locations` | JWT | Listar ubicaciones (`?lat=&lng=` opcional para distancia) |
| `GET` | `/locations/:location_id` | JWT | Detalles de una ubicación |
| `PATCH` | `/locations/:location_id` | JWT | Actualizar dirección, coordenadas o `is_primary` |
| `DELETE` | `/locations/:location_id` | JWT | Eliminar ubicación |

### Validaciones
- `address`: obligatorio en POST, opcional en PATCH, 3-255 caracteres
- `latitude`: rango `[-90, 90]`
- `longitude`: rango `[-180, 180]`
- `is_primary`: booleano opcional
- Máximo **10 ubicaciones** por usuario (`409 LOCATION_LIMIT_REACHED`)
- Autorización: `403` en rutas `/users/:id/locations` si el JWT no coincide con `:id`; `404` en `/locations/:location_id` si no existe o no pertenece al usuario

### Base de Datos
- La tabla `locations` ya existía desde la migración inicial con columna `geography(Point, 4326)` (PostGIS) e índice GiST. No se requirió migración adicional.

---

## Issue #22: Búsqueda de Trabajadores por Geolocalización

Se ha completado el desarrollo del endpoint que retorna trabajadores disponibles dentro de un radio desde una ubicación, usando PostGIS para queries espaciales eficientes, filtrado por categoría, ordenamiento por distancia y paginación, con caché en Redis (TTL 5 min).

### Cambios Realizados

Archivos creados:

- [cache.js](file:///home/thiagox/Documentos/Backend/src/utils/cache.js): Servicio de caché con `redis` (vía `REDIS_URL`) y degradación automática a caché en memoria con el mismo comportamiento de TTL si Redis no está disponible.
- [WorkerSearchService.js](file:///home/thiagox/Documentos/Backend/src/services/WorkerSearchService.js): Servicio con `findNearby({ latitude, longitude, radius_km, category_id, limit, offset })`. Consulta PostGIS (ST_DWithin para el radio + ST_DistanceSphere para la distancia), filtra por `availability_status = 'AVAILABLE'` y `certification_status = 'APPROVED'`, ordena por distancia ascendente y cachea resultados en Redis con TTL de 300 s.
- [WorkerSearchController.js](file:///home/thiagox/Documentos/Backend/src/controllers/WorkerSearchController.js): Controlador que valida los query params con Joi y delega en el servicio.
- [workerRoutes.js](file:///home/thiagox/Documentos/Backend/src/routes/workerRoutes.js): Ruta `GET /nearby`, montada en `/api/v1/workers`.
- [workerSearch.test.js](file:///home/thiagox/Documentos/Backend/tests/workerSearch.test.js): 12 tests (servicio, validación Joi, controlador).

Archivos modificados:

- [validation.js](file:///home/thiagox/Documentos/Backend/src/utils/validation.js): Agrega `nearbyWorkersQuerySchema` (radius_km 1-100, limit máx. 100 default 20, offset).
- [app.js](file:///home/thiagox/Documentos/Backend/src/app.js): Monta `workerRoutes` en `/api/v1/workers`.
- [server.js](file:///home/thiagox/Documentos/Backend/src/server.js): Conecta la caché al iniciar y la desconecta en el shutdown.
- [swagger.js](file:///home/thiagox/Documentos/Backend/src/utils/swagger.js): Documenta el endpoint con schemas de request/response.
- [package.json](file:///home/thiagox/Documentos/Backend/package.json): Agrega dependencia `redis`.
- [docker-compose.yml](file:///home/thiagox/Documentos/Backend/docker-compose.yml): Agrega servicio `redis` (redis:7-alpine).
- [.env.example](file:///home/thiagox/Documentos/Backend/.env.example): Documenta `REDIS_URL`.

### Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/workers/nearby` | JWT | Buscar trabajadores en un radio |

### Parámetros de Query

| Parámetro | Tipo | Obligatorio | Restricciones |
|-----------|------|-------------|---------------|
| `latitude` | number | Sí | `[-90, 90]` |
| `longitude` | number | Sí | `[-180, 180]` |
| `radius_km` | number | Sí | `[1, 100]` |
| `category_id` | uuid | No | Filtro por categoría |
| `limit` | integer | No | `[1, 100]`, default 20 |
| `offset` | integer | No | `>= 0`, default 0 |

### Comportamiento de la Query
- Filtra `worker_profiles.availability_status = 'AVAILABLE'` y `certification_status = 'APPROVED'` (el "ACTIVE" del issue equivale a `APPROVED` en el schema actual).
- Usa la ubicación principal (`locations.is_primary = true`) de cada trabajador.
- Radio con `ST_DWithin(geography, punto, metros)` (aprovecha el índice GiST).
- Distancia con `ST_DistanceSphere` (metros → `distance_km` en la respuesta).
- Rating promedio desde `ratings` (subquery por `ratee_id`).
- Caché en Redis con TTL de 5 minutos, clave basada en los parámetros normalizados.

### Base de Datos
- No se requirió migración; se reutiliza `locations.geography` y el índice GiST existentes.

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
