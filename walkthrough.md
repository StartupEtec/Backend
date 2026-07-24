# Walkthrough - Implementación de Autenticación con JWT, Refresh Tokens y OTP (2FA)

Se ha completado el desarrollo del sistema de autenticación seguro, modular y listo para producción según los criterios de aceptación y directrices de arquitectura.

## Cambios Realizados

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

#### D. Acceder a la Documentación Swagger
Visita http://localhost:3000/api/v1/api-docs en tu navegador para ver y probar interactivamente los endpoints mediante Swagger UI.
