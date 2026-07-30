import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Backend API — Plataforma de Trabajo Independiente On-Demand',
      version: '1.0.0',
      description: `
## Flujo de Autenticación con Verificación en Dos Pasos (2FA/OTP)

La API implementa un sistema de autenticación con JWT y verificación OTP de dos pasos.

### Flujo de Registro
1. \`POST /auth/register\` — Crea el usuario y envía un OTP por Email/SMS.
2. \`POST /auth/verify-otp\` — Valida el OTP. Devuelve \`accessToken\` + \`refreshToken\`.

### Flujo de Login
1. \`POST /auth/login\` — Valida credenciales. Si son correctas, envía OTP y retorna estado \`PENDING_VERIFICATION\`.
2. \`POST /auth/verify-otp\` — Valida el OTP. Devuelve \`accessToken\` + \`refreshToken\`.

### Renovación de token
- \`POST /auth/refresh-token\` — Usa el \`refreshToken\` para obtener un nuevo \`accessToken\` + nuevo \`refreshToken\` (rotación de token por seguridad).

### Tokens
- **accessToken**: JWT firmado, payload \`{ user_id, email, current_role, iat, exp }\`. Expira en **1 hora**.
- **refreshToken**: JWT firmado, payload \`{ user_id, jti, exp }\`. Expira en **7 días**. Almacenado en BD para revocación.

### Rate Limiting
Los endpoints de autenticación tienen un límite de **5 intentos por IP cada 15 minutos**.
      `,
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Servidor local de desarrollo',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingrese el accessToken obtenido de /auth/verify-otp',
        },
      },
      schemas: {
        // ── User Profile schemas ──────────────────────────────────────────
        PublicProfileResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            full_name: { type: 'string', example: 'Juan Pérez' },
            avatar_url: {
              type: 'string',
              example: 'https://example.com/avatar.jpg',
              nullable: true,
            },
            bio: {
              type: 'string',
              example: 'Técnico especialista en reparaciones',
              nullable: true,
            },
            average_rating: {
              type: 'string',
              example: '4.5',
              nullable: true,
              description: 'Rating promedio del usuario',
            },
            role: { type: 'string', example: 'worker', enum: ['worker', 'client'] },
          },
        },
        PrivateProfileResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email', example: 'usuario@example.com' },
            phone: { type: 'string', example: '3001234567' },
            current_role: { type: 'string', example: 'client' },
            is_verified: { type: 'boolean', example: true },
            verified_email: { type: 'boolean', example: false },
            verified_phone: { type: 'boolean', example: false },
            active: { type: 'boolean', example: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            average_rating: { type: 'string', example: '4.5', nullable: true },
            profile: {
              type: 'object',
              properties: {
                client: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    full_name: { type: 'string' },
                    avatar_url: { type: 'string', nullable: true },
                    bio: { type: 'string', nullable: true },
                  },
                },
                worker: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    full_name: { type: 'string' },
                    avatar_url: { type: 'string', nullable: true },
                    bio: { type: 'string', nullable: true },
                    hourly_rate: { type: 'number', example: 25.5 },
                    availability_status: { type: 'string', example: 'AVAILABLE' },
                    certification_status: { type: 'string', example: 'PENDING' },
                  },
                },
              },
            },
          },
        },
        // ── Client Profile schemas ─────────────────────────────────────────
        ClientProfileResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            user_id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            full_name: { type: 'string', example: 'Juan Pérez' },
            avatar_url: {
              type: 'string',
              example: 'https://example.com/avatar.jpg',
              nullable: true,
            },
            bio: { type: 'string', example: 'Cliente desde 2024', nullable: true },
            default_location_id: { type: 'string', format: 'uuid', nullable: true },
            preferences: {
              type: 'object',
              nullable: true,
              example: { notifications: true, language: 'es', theme: 'light' },
              description: 'Preferencias del cliente en JSON',
            },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateClientProfileRequest: {
          type: 'object',
          required: ['full_name'],
          properties: {
            full_name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              example: 'Juan Pérez',
              description: 'Nombre completo del cliente',
            },
            avatar_url: {
              type: 'string',
              example: 'https://example.com/avatar.jpg',
              description: 'URL del avatar (JPG/PNG)',
              nullable: true,
            },
            bio: {
              type: 'string',
              maxLength: 500,
              example: 'Cliente desde 2024',
              description: 'Biografía del cliente (máx. 500 caracteres)',
              nullable: true,
            },
            default_location_id: {
              type: 'string',
              format: 'uuid',
              example: 'a1b2c3d4-...',
              description: 'ID de la ubicación por defecto',
              nullable: true,
            },
            preferences: {
              type: 'object',
              nullable: true,
              example: { notifications: true, language: 'es', theme: 'light' },
              description: 'Preferencias del cliente en formato JSON',
            },
          },
        },
        UpdateClientProfileRequest: {
          type: 'object',
          properties: {
            full_name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              example: 'Juan Pérez',
              description: 'Nombre completo del cliente',
            },
            avatar_url: {
              type: 'string',
              example: 'https://example.com/avatar.jpg',
              description: 'URL del avatar (JPG/PNG)',
              nullable: true,
            },
            bio: {
              type: 'string',
              maxLength: 500,
              example: 'Cliente desde 2024',
              description: 'Biografía del cliente (máx. 500 caracteres)',
              nullable: true,
            },
            default_location_id: {
              type: 'string',
              format: 'uuid',
              example: 'a1b2c3d4-...',
              description: 'ID de la ubicación por defecto',
              nullable: true,
            },
            preferences: {
              type: 'object',
              nullable: true,
              example: { notifications: true, language: 'es', theme: 'light' },
              description: 'Preferencias del cliente en formato JSON',
            },
          },
          description: 'Todos los campos son opcionales en PATCH',
        },
        CreateClientProfileResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Perfil de cliente creado correctamente' },
            profile: { $ref: '#/components/schemas/ClientProfileResponse' },
          },
        },
        UpdateClientProfileResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Perfil de cliente actualizado correctamente' },
            profile: { $ref: '#/components/schemas/ClientProfileResponse' },
          },
        },
        ClientProfileExistsError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'CLIENT_PROFILE_EXISTS' },
            message: {
              type: 'string',
              example: 'El perfil de cliente ya existe. Usa PATCH para actualizarlo.',
            },
            statusCode: { type: 'integer', example: 409 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ClientProfileNotFoundError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'CLIENT_PROFILE_NOT_FOUND' },
            message: {
              type: 'string',
              example: 'Perfil de cliente no encontrado. Crea uno con POST.',
            },
            statusCode: { type: 'integer', example: 404 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },

        UpdateProfileRequest: {
          type: 'object',
          required: ['full_name'],
          properties: {
            full_name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              example: 'Juan Pérez',
              description: 'Nombre completo del usuario',
            },
            avatar_url: {
              type: 'string',
              example: 'https://example.com/avatar.jpg',
              description: 'URL del avatar (JPG/PNG)',
              nullable: true,
            },
            bio: {
              type: 'string',
              maxLength: 500,
              example: 'Técnico especialista en reparaciones',
              description: 'Biografía del usuario (máx. 500 caracteres)',
              nullable: true,
            },
          },
        },
        UpdateProfileResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Perfil actualizado correctamente' },
            profile: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                full_name: { type: 'string' },
                avatar_url: { type: 'string', nullable: true },
                bio: { type: 'string', nullable: true },
                updated_at: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        NotFoundError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'USER_NOT_FOUND' },
            message: { type: 'string', example: 'Usuario no encontrado' },
            statusCode: { type: 'integer', example: 404 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        // ── Request schemas ──────────────────────────────────────────────
        RegisterRequest: {
          type: 'object',
          required: ['email', 'phone', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'usuario@example.com' },
            phone: {
              type: 'string',
              minLength: 8,
              maxLength: 15,
              example: '3001234567',
              description: 'Número de teléfono (8–15 dígitos)',
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'P@ssword123!',
              description:
                'Mínimo 8 caracteres, debe incluir: mayúscula, minúscula, número y símbolo',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'usuario@example.com',
              description: 'Requerido si no se proporciona phone',
            },
            phone: {
              type: 'string',
              example: '3001234567',
              description: 'Requerido si no se proporciona email',
            },
            password: { type: 'string', format: 'password', example: 'P@ssword123!' },
          },
        },
        VerifyOtpRequest: {
          type: 'object',
          required: ['otp_code'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'usuario@example.com',
              description: 'Requerido si no se proporciona phone',
            },
            phone: {
              type: 'string',
              example: '3001234567',
              description: 'Requerido si no se proporciona email',
            },
            otp_code: {
              type: 'string',
              minLength: 6,
              maxLength: 6,
              example: '123456',
              description: 'Código OTP de 6 dígitos recibido por Email/SMS',
            },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              description: 'Refresh token obtenido de /auth/verify-otp',
            },
          },
        },
        ForgotPasswordRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email', example: 'usuario@example.com' },
            phone: { type: 'string', example: '3001234567' },
          },
          description: 'Debe proporcionarse al menos email o phone',
        },
        VerifyResetCodeRequest: {
          type: 'object',
          required: ['reset_code'],
          properties: {
            email: { type: 'string', format: 'email', example: 'usuario@example.com' },
            phone: { type: 'string', example: '3001234567' },
            reset_code: {
              type: 'string',
              minLength: 6,
              maxLength: 6,
              example: '123456',
              description: 'Código de recuperación de 6 dígitos',
            },
          },
          description: 'Debe proporcionarse al menos email o phone junto con el código',
        },
        ResetPasswordRequest: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUz...',
              description: 'Token temporal obtenido de /auth/verify-reset-code',
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'NewSecureP@ss1!',
              description: 'Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo',
            },
          },
        },
        TempTokenResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Código verificado correctamente.' },
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUz...',
              description: 'Token temporal de restablecimiento. Válido por 10 minutos.',
            },
          },
        },

        // ── Success response schemas ──────────────────────────────────────
        RegisterResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example:
                'Usuario registrado correctamente. Por favor verifica tu cuenta con el código OTP enviado.',
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
                email: { type: 'string', example: 'usuario@example.com' },
                phone: { type: 'string', example: '3001234567' },
              },
            },
          },
        },
        LoginPendingResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'PENDING_VERIFICATION' },
            message: {
              type: 'string',
              example: 'Código OTP enviado al correo/teléfono registrado.',
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string' },
              },
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Verificación exitosa' },
            accessToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUz...',
              description: 'JWT de acceso. Expira en 1 hora.',
            },
            refreshToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUz...',
              description: 'Token de refresco. Expira en 7 días.',
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string' },
                phone: { type: 'string' },
              },
            },
          },
        },
        RefreshTokenResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUz...' },
            refreshToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUz...',
              description: 'Nuevo refresh token (el anterior queda revocado)',
            },
          },
        },

        // ── Error response schemas ────────────────────────────────────────
        ValidationError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'VALIDATION_ERROR' },
            message: {
              type: 'string',
              example:
                'La contraseña debe tener al menos 8 caracteres, incluir una mayúscula, una minúscula, un número y un símbolo',
            },
            statusCode: { type: 'integer', example: 400 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        UnauthorizedError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'AUTH_FAILED' },
            message: { type: 'string', example: 'Credenciales incorrectas' },
            statusCode: { type: 'integer', example: 401 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        InvalidOtpError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'INVALID_OTP' },
            message: { type: 'string', example: 'Código OTP inválido o expirado' },
            statusCode: { type: 'integer', example: 400 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ConflictError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'CONFLICT_ERROR' },
            message: {
              type: 'string',
              example: 'El correo electrónico o teléfono ya están registrados',
            },
            statusCode: { type: 'integer', example: 409 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        InvalidRefreshTokenError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'INVALID_REFRESH_TOKEN' },
            message: {
              type: 'string',
              example: 'Token de refresco inválido, expirado o ya utilizado',
            },
            statusCode: { type: 'integer', example: 401 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        RateLimitError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'TOO_MANY_REQUESTS' },
            message: {
              type: 'string',
              example:
                'Demasiados intentos de autenticación. Por favor, intente de nuevo en 15 minutos.',
            },
            statusCode: { type: 'integer', example: 429 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ForbiddenError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'FORBIDDEN' },
            message: {
              type: 'string',
              example: 'No tiene permisos suficientes para acceder a este recurso',
            },
            statusCode: { type: 'integer', example: 403 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js', './src/utils/swagger.js'],
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app) => {
  app.use('/api/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     description: |
 *       Crea una cuenta nueva con email, teléfono y contraseña.
 *       Al finalizar, envía un código OTP de 6 dígitos por Email y SMS.
 *       El usuario debe verificar el OTP mediante `POST /auth/verify-otp` para activar su cuenta.
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           example:
 *             email: usuario@example.com
 *             phone: "3001234567"
 *             password: "P@ssword123!"
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente. OTP enviado por Email y SMS.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegisterResponse'
 *       400:
 *         description: Error de validación (email inválido, contraseña débil, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       409:
 *         description: El correo electrónico o teléfono ya están registrados.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConflictError'
 *       429:
 *         description: Demasiados intentos. Rate limit excedido (5 req/IP/15min).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión del usuario
 *     description: |
 *       Valida las credenciales del usuario. Si son correctas, genera y envía un OTP por Email/SMS
 *       y retorna el estado `PENDING_VERIFICATION`. El usuario debe verificar el OTP con
 *       `POST /auth/verify-otp` para obtener el JWT de acceso.
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             loginConEmail:
 *               summary: Login con email
 *               value:
 *                 email: usuario@example.com
 *                 password: "P@ssword123!"
 *             loginConTelefono:
 *               summary: Login con teléfono
 *               value:
 *                 phone: "3001234567"
 *                 password: "P@ssword123!"
 *     responses:
 *       200:
 *         description: Credenciales válidas. OTP enviado. Estado PENDING_VERIFICATION.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginPendingResponse'
 *       400:
 *         description: Error de validación.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Credenciales incorrectas (usuario no encontrado o contraseña inválida).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       429:
 *         description: Rate limit excedido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *
 * /auth/verify-otp:
 *   post:
 *     summary: Verificar código OTP (2FA)
 *     description: |
 *       Valida el código OTP de 6 dígitos enviado durante el registro o login.
 *       Si el OTP es válido y no ha expirado (10 minutos), devuelve un JWT de acceso
 *       y un refresh token. El OTP se invalida automáticamente tras un uso exitoso.
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
 *           example:
 *             email: usuario@example.com
 *             otp_code: "123456"
 *     responses:
 *       200:
 *         description: OTP verificado exitosamente. Devuelve JWT + RefreshToken.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: OTP inválido, incorrecto o expirado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvalidOtpError'
 *       429:
 *         description: Rate limit excedido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *
 * /auth/refresh-token:
 *   post:
 *     summary: Renovar JWT de acceso mediante refresh token
 *     description: |
 *       Valida el refresh token, lo revoca (rotación de token por seguridad) y emite un nuevo
 *       accessToken (1 hora) + nuevo refreshToken (7 días).
 *       El refresh token anterior queda invalidado inmediatamente tras este llamado.
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Nuevo JWT y RefreshToken (rotado) emitidos exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RefreshTokenResponse'
 *       400:
 *         description: Error de validación.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Refresh token inválido, expirado o ya revocado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvalidRefreshTokenError'
 *       429:
 *         description: Rate limit excedido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *
 * /auth/forgot-password:
 *   post:
 *     summary: Solicitar código de recuperación de contraseña
 *     description: |
 *       Acepta email o phone y genera un código de recuperación de 6 dígitos válido por 30 minutos.
 *       Envía el código de forma simulada por SMS/Email (revisar logs en desarrollo).
 *       Protegido por rate limiting (5 req/IP/15min).
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: Código de recuperación enviado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Código de recuperación enviado correctamente.
 *       400:
 *         description: Error de validación.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       404:
 *         description: Usuario no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       429:
 *         description: Rate limit excedido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *
 * /auth/verify-reset-code:
 *   post:
 *     summary: Validar código de recuperación
 *     description: |
 *       Valida el código de recuperación enviado. Si es correcto, retorna un token temporal de JWT
 *       válido por 10 minutos. El código se limpia tras la validación.
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyResetCodeRequest'
 *     responses:
 *       200:
 *         description: Código verificado correctamente. Retorna token temporal.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TempTokenResponse'
 *       400:
 *         description: Código de recuperación inválido o expirado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       429:
 *         description: Rate limit excedido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *
 * /auth/reset-password:
 *   post:
 *     summary: Restablecer contraseña con token temporal
 *     description: |
 *       Acepta el token temporal de JWT (obtenido de /auth/verify-reset-code) y la nueva contraseña.
 *       Verifica la firma y validez del token contra el hash de contraseña actual (permitiendo un solo uso).
 *       Actualiza la base de datos y audita la acción.
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Contraseña restablecida correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Contraseña restablecida correctamente.
 *       400:
 *         description: Token temporal inválido/expirado o error de validación de contraseña.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       429:
 *         description: Rate limit excedido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *
 * /users/{id}:
 *   get:
 *     summary: Obtener perfil público de un usuario
 *     description: |
 *       Retorna la información pública del perfil de un usuario (nombre, avatar, bio, rating promedio).
 *       No requiere autenticación.
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del usuario
 *     responses:
 *       200:
 *         description: Perfil público del usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PublicProfileResponse'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *   patch:
 *     summary: Actualizar perfil de usuario
 *     description: |
 *       Actualiza el nombre, avatar y/o biografía del perfil del usuario autenticado.
 *       Solo el propio usuario puede modificar su perfil (validación por JWT).
 *       Los cambios se registran en el log de auditoría.
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del usuario (debe coincidir con el token)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *           example:
 *             full_name: "Juan Pérez"
 *             avatar_url: "https://example.com/avatar.jpg"
 *             bio: "Técnico especialista en reparaciones"
 *     responses:
 *       200:
 *         description: Perfil actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UpdateProfileResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: No autorizado para editar este perfil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *
 * /users/me:
 *   get:
 *     summary: Obtener perfil privado del usuario autenticado
 *     description: |
 *       Retorna la información completa del usuario autenticado, incluyendo datos privados
 *       (email, teléfono) y ambos perfiles (cliente y trabajador).
 *       Requiere token JWT.
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil completo del usuario autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PrivateProfileResponse'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Token inválido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *
 * /users/{id}/client-profile:
 *   get:
 *     summary: Obtener perfil de cliente
 *     description: |
 *       Retorna el perfil de cliente del usuario autenticado.
 *       Solo el propio usuario puede acceder a su perfil (validación por JWT).
 *       Si no existe, retorna 404 con indicación de usar POST.
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del usuario
 *     responses:
 *       200:
 *         description: Perfil de cliente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientProfileResponse'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: No autorizado para acceder a este perfil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Perfil de cliente no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientProfileNotFoundError'
 *   post:
 *     summary: Crear perfil de cliente
 *     description: |
 *       Crea un nuevo perfil de cliente para el usuario autenticado.
 *       Solo el propio usuario puede crear su perfil (validación por JWT).
 *       Si el perfil ya existe, retorna 409.
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateClientProfileRequest'
 *           example:
 *             full_name: "Juan Pérez"
 *             avatar_url: "https://example.com/avatar.jpg"
 *             bio: "Cliente desde 2024"
 *             default_location_id: "a1b2c3d4-..."
 *             preferences:
 *               notifications: true
 *               language: "es"
 *               theme: "light"
 *     responses:
 *       201:
 *         description: Perfil de cliente creado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateClientProfileResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: No autorizado para crear este perfil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       409:
 *         description: El perfil de cliente ya existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientProfileExistsError'
 *   patch:
 *     summary: Actualizar perfil de cliente
 *     description: |
 *       Actualiza los datos del perfil de cliente del usuario autenticado.
 *       Solo el propio usuario puede actualizar su perfil (validación por JWT).
 *       Todos los campos son opcionales. Si el perfil no existe, retorna 404.
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateClientProfileRequest'
 *           example:
 *             full_name: "Juan Pérez Actualizado"
 *             bio: "Nueva biografía"
 *             preferences:
 *               notifications: false
 *               language: "en"
 *     responses:
 *       200:
 *         description: Perfil de cliente actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UpdateClientProfileResponse'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: No autorizado para actualizar este perfil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Perfil de cliente no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientProfileNotFoundError'
 */
