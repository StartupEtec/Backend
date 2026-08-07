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

        // ── Worker Profile schemas ────────────────────────────────────────
        WorkerProfileResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            user_id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            full_name: { type: 'string', example: 'Carlos García' },
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
            category_id: {
              type: 'string',
              format: 'uuid',
              example: 'b2c3d4e5-...',
              nullable: true,
            },
            category_name: { type: 'string', example: 'Plumbing', nullable: true },
            hourly_rate: { type: 'number', example: 35.5 },
            availability_status: {
              type: 'string',
              example: 'AVAILABLE',
              enum: ['AVAILABLE', 'BUSY', 'OFFLINE'],
            },
            certification_status: {
              type: 'string',
              example: 'PENDING',
              enum: ['PENDING', 'APPROVED', 'REJECTED'],
            },
            average_rating: {
              type: 'string',
              example: '4.5',
              nullable: true,
            },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateWorkerProfileRequest: {
          type: 'object',
          required: ['full_name', 'category_id', 'hourly_rate'],
          properties: {
            full_name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              example: 'Carlos García',
              description: 'Nombre completo del trabajador',
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
              description: 'Biografía del trabajador (máx. 500 caracteres)',
              nullable: true,
            },
            category_id: {
              type: 'string',
              format: 'uuid',
              example: 'b2c3d4e5-...',
              description: 'ID de la categoría de servicio',
            },
            hourly_rate: {
              type: 'number',
              example: 35.5,
              description: 'Tarifa por hora (valor positivo)',
            },
            availability_status: {
              type: 'string',
              example: 'AVAILABLE',
              enum: ['AVAILABLE', 'BUSY', 'OFFLINE'],
              description: 'Estado de disponibilidad (por defecto AVAILABLE)',
            },
          },
        },
        UpdateWorkerProfileRequest: {
          type: 'object',
          properties: {
            full_name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              example: 'Carlos García',
              description: 'Nombre completo del trabajador',
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
              description: 'Biografía del trabajador (máx. 500 caracteres)',
              nullable: true,
            },
            category_id: {
              type: 'string',
              format: 'uuid',
              example: 'b2c3d4e5-...',
              description: 'ID de la categoría de servicio',
            },
            hourly_rate: {
              type: 'number',
              example: 40.0,
              description: 'Tarifa por hora (valor positivo)',
            },
            availability_status: {
              type: 'string',
              example: 'BUSY',
              enum: ['AVAILABLE', 'BUSY', 'OFFLINE'],
              description: 'Estado de disponibilidad',
            },
          },
          description: 'Todos los campos son opcionales en PATCH',
        },
        CreateWorkerProfileResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Perfil de trabajador creado correctamente' },
            profile: { $ref: '#/components/schemas/WorkerProfileResponse' },
          },
        },
        UpdateWorkerProfileResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Perfil de trabajador actualizado correctamente' },
            profile: { $ref: '#/components/schemas/WorkerProfileResponse' },
          },
        },
        WorkerProfileExistsError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'WORKER_PROFILE_EXISTS' },
            message: {
              type: 'string',
              example: 'El perfil de trabajador ya existe. Usa PATCH para actualizarlo.',
            },
            statusCode: { type: 'integer', example: 409 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        WorkerProfileNotFoundError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'WORKER_PROFILE_NOT_FOUND' },
            message: {
              type: 'string',
              example: 'Perfil de trabajador no encontrado. Crea uno con POST.',
            },
            statusCode: { type: 'integer', example: 404 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },

        // ── Switch Role schemas ───────────────────────────────────────────
        SwitchRoleRequest: {
          type: 'object',
          required: ['role'],
          properties: {
            role: {
              type: 'string',
              example: 'worker',
              enum: ['client', 'worker'],
              description: 'Rol al que se desea cambiar (client o worker)',
            },
          },
        },
        SwitchRoleResponse: {
          type: 'object',
          properties: {
            new_role: {
              type: 'string',
              example: 'worker',
              enum: ['client', 'worker'],
              description: 'Rol activo después del cambio',
            },
            previous_role: {
              type: 'string',
              example: 'client',
              enum: ['client', 'worker'],
              nullable: true,
              description: 'Rol anterior antes del cambio',
            },
            accessToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIs...',
              description: 'Nuevo JWT con el rol actualizado. Expira en 1 hora.',
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        SwitchRoleSameRoleError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'SAME_ROLE' },
            message: {
              type: 'string',
              example: 'El usuario ya tiene el rol worker',
            },
            statusCode: { type: 'integer', example: 409 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        SwitchRoleMissingProfileError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'MISSING_WORKER_PROFILE' },
            message: {
              type: 'string',
              example: 'Debes tener un perfil de trabajador para cambiar de rol',
            },
            statusCode: { type: 'integer', example: 409 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        SwitchRoleNotCertifiedError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'WORKER_NOT_CERTIFIED' },
            message: {
              type: 'string',
              example:
                'Tu perfil de trabajador debe tener certificación aprobada para activar el rol',
            },
            statusCode: { type: 'integer', example: 403 },
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

        // ── Location schemas ─────────────────────────────────────────────
        LocationResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            user_id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            address: {
              type: 'string',
              example: 'Calle Falsa 123, Bogotá',
              description: 'Dirección formateada en texto plano',
            },
            latitude: { type: 'number', example: 4.711 },
            longitude: { type: 'number', example: -74.0721 },
            is_primary: {
              type: 'boolean',
              example: false,
              description: 'Si es la ubicación principal del usuario',
            },
            distance_m: {
              type: 'number',
              example: 1240.5,
              nullable: true,
              description:
                'Distancia en metros desde el punto de referencia (lat/lng). Solo en el listado cuando se provee lat/lng.',
            },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateLocationRequest: {
          type: 'object',
          required: ['address', 'latitude', 'longitude'],
          properties: {
            address: {
              type: 'string',
              minLength: 3,
              maxLength: 255,
              example: 'Calle Falsa 123, Bogotá',
              description: 'Dirección formateada en texto plano',
            },
            latitude: {
              type: 'number',
              minimum: -90,
              maximum: 90,
              example: 4.711,
              description: 'Latitud decimal dentro del rango [-90, 90]',
            },
            longitude: {
              type: 'number',
              minimum: -180,
              maximum: 180,
              example: -74.0721,
              description: 'Longitud decimal dentro del rango [-180, 180]',
            },
            is_primary: {
              type: 'boolean',
              example: false,
              description: 'Marcar como ubicación principal (por defecto la primera lo es)',
            },
          },
        },
        UpdateLocationRequest: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              minLength: 3,
              maxLength: 255,
              example: 'Calle Nueva 456, Bogotá',
              description: 'Nueva dirección',
            },
            latitude: { type: 'number', minimum: -90, maximum: 90, example: 4.7 },
            longitude: { type: 'number', minimum: -180, maximum: 180, example: -74.07 },
            is_primary: {
              type: 'boolean',
              example: true,
              description: 'Marcar como ubicación principal (quita el flag a las demás)',
            },
          },
          description: 'Todos los campos son opcionales en PATCH',
        },
        CreateLocationResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Ubicación creada correctamente' },
            location: { $ref: '#/components/schemas/LocationResponse' },
          },
        },
        UpdateLocationResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Ubicación actualizada correctamente' },
            location: { $ref: '#/components/schemas/LocationResponse' },
          },
        },
        ListLocationsResponse: {
          type: 'object',
          properties: {
            locations: {
              type: 'array',
              items: { $ref: '#/components/schemas/LocationResponse' },
            },
            count: { type: 'integer', example: 3 },
          },
        },
        LocationLimitReachedError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'LOCATION_LIMIT_REACHED' },
            message: { type: 'string', example: 'Máximo de 10 ubicaciones por usuario alcanzado' },
            statusCode: { type: 'integer', example: 409 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        LocationNotFoundError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'LOCATION_NOT_FOUND' },
            message: { type: 'string', example: 'Ubicación no encontrada' },
            statusCode: { type: 'integer', example: 404 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },

        // ── Worker Search schemas ────────────────────────────────────────
        NearbyWorker: {
          type: 'object',
          properties: {
            worker_id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            user_id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            full_name: { type: 'string', example: 'Carlos García' },
            avatar_url: {
              type: 'string',
              example: 'https://example.com/avatar.jpg',
              nullable: true,
            },
            category_id: { type: 'string', format: 'uuid', nullable: true },
            category_name: { type: 'string', example: 'Plomería', nullable: true },
            hourly_rate: { type: 'number', example: 35.5 },
            availability_status: { type: 'string', example: 'AVAILABLE' },
            certification_status: { type: 'string', example: 'APPROVED' },
            average_rating: { type: 'string', example: '4.5', nullable: true },
            distance_km: { type: 'number', example: 1.24 },
            latitude: { type: 'number', example: 4.711 },
            longitude: { type: 'number', example: -74.0721 },
          },
        },
        NearbyWorkersResponse: {
          type: 'object',
          properties: {
            workers: {
              type: 'array',
              items: { $ref: '#/components/schemas/NearbyWorker' },
            },
            count: { type: 'integer', example: 3 },
            limit: { type: 'integer', example: 20 },
            offset: { type: 'integer', example: 0 },
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
 *
 * /users/{id}/worker-profile:
 *   get:
 *     summary: Obtener perfil de trabajador
 *     description: |
 *       Retorna el perfil de trabajador del usuario autenticado con rol worker.
 *       Solo el propio usuario puede acceder a su perfil (validación por JWT y rol worker).
 *       Incluye nombre, categoría, tarifa, biografía, rating promedio y disponibilidad.
 *       Si no existe, retorna 404 con indicación de usar POST.
 *     tags: [Trabajadores]
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
 *         description: Perfil de trabajador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkerProfileResponse'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: No autorizado (rol incorrecto o acceso a otro perfil)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Perfil de trabajador no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkerProfileNotFoundError'
 *   post:
 *     summary: Crear perfil de trabajador
 *     description: |
 *       Crea un nuevo perfil de trabajador para el usuario autenticado con rol worker.
 *       Solo el propio usuario puede crear su perfil (validación por JWT y rol worker).
 *       Si el perfil ya existe, retorna 409.
 *     tags: [Trabajadores]
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
 *             $ref: '#/components/schemas/CreateWorkerProfileRequest'
 *           example:
 *             full_name: "Carlos García"
 *             avatar_url: "https://example.com/avatar.jpg"
 *             bio: "Técnico especialista en reparaciones"
 *             category_id: "b2c3d4e5-..."
 *             hourly_rate: 35.5
 *             availability_status: "AVAILABLE"
 *     responses:
 *       201:
 *         description: Perfil de trabajador creado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateWorkerProfileResponse'
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
 *         description: No autorizado (rol incorrecto o acceso a otro perfil)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       409:
 *         description: El perfil de trabajador ya existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkerProfileExistsError'
 *   patch:
 *     summary: Actualizar perfil de trabajador
 *     description: |
 *       Actualiza los datos del perfil de trabajador del usuario autenticado.
 *       Solo el propio usuario puede actualizar su perfil (validación por JWT y rol worker).
 *       Todos los campos son opcionales. Si el perfil no existe, retorna 404.
 *     tags: [Trabajadores]
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
 *             $ref: '#/components/schemas/UpdateWorkerProfileRequest'
 *           example:
 *             hourly_rate: 40.0
 *             availability_status: "BUSY"
 *             bio: "Nueva biografía actualizada"
 *     responses:
 *       200:
 *         description: Perfil de trabajador actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UpdateWorkerProfileResponse'
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
 *         description: No autorizado (rol incorrecto o acceso a otro perfil)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Perfil de trabajador no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkerProfileNotFoundError'
 *
 * /users/{id}/switch-role:
 *   post:
 *     summary: Cambiar rol activo del usuario (dual-role)
 *     description: |
 *       Permite a un usuario con rol dual alternar entre cliente y trabajador.
 *       Valida que ambos perfiles (client_profiles y worker_profiles) existan.
 *       Si se cambia a worker, verifica que la certificación esté aprobada.
 *       Re-emite un nuevo JWT con el rol actualizado.
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
 *         description: UUID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SwitchRoleRequest'
 *           example:
 *             role: "worker"
 *     responses:
 *       200:
 *         description: Rol cambiado exitosamente. Nuevo JWT emitido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SwitchRoleResponse'
 *       400:
 *         description: Error de validación (rol inválido)
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
 *         description: Certificación no aprobada o acceso a otro usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SwitchRoleNotCertifiedError'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       409:
 *         description: Mismo rol actual o perfil faltante
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SwitchRoleSameRoleError'
 *                 - $ref: '#/components/schemas/SwitchRoleMissingProfileError'
 */

/**
 * @openapi
 * /users/{id}/locations:
 *   post:
 *     summary: Crear una ubicación para el usuario
 *     description: |
 *       Crea una nueva ubicación guardada con dirección y coordenadas (PostGIS).
 *       Solo el propio usuario puede crear sus ubicaciones (validación por JWT).
 *       La primera ubicación se marca como principal automáticamente.
 *       Máximo 10 ubicaciones por usuario.
 *     tags: [Ubicaciones]
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
 *             $ref: '#/components/schemas/CreateLocationRequest'
 *           example:
 *             address: "Calle Falsa 123, Bogotá"
 *             latitude: 4.711
 *             longitude: -74.0721
 *             is_primary: false
 *     responses:
 *       201:
 *         description: Ubicación creada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateLocationResponse'
 *       400:
 *         description: Error de validación (coordenadas fuera de rango, etc.)
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
 *         description: No autorizado para crear ubicaciones de otro usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       409:
 *         description: Máximo de 10 ubicaciones por usuario alcanzado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LocationLimitReachedError'
 *   get:
 *     summary: Listar las ubicaciones del usuario
 *     description: |
 *       Retorna todas las ubicaciones guardadas del usuario.
 *       Si se proveen los query params `lat` y `lng`, cada ubicación incluye
 *       `distance_m` (metros) calculado con PostGIS desde ese punto de referencia.
 *       Solo el propio usuario puede listar sus ubicaciones.
 *     tags: [Ubicaciones]
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
 *       - in: query
 *         name: lat
 *         required: false
 *         schema:
 *           type: number
 *         description: Latitud del punto de referencia (requiere lng)
 *       - in: query
 *         name: lng
 *         required: false
 *         schema:
 *           type: number
 *         description: Longitud del punto de referencia (requiere lat)
 *     responses:
 *       200:
 *         description: Lista de ubicaciones del usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListLocationsResponse'
 *       400:
 *         description: Error de validación de los query params
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
 *         description: No autorizado para listar ubicaciones de otro usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 */

/**
 * @openapi
 * /locations/{location_id}:
 *   get:
 *     summary: Obtener detalles de una ubicación
 *     description: |
 *       Retorna los detalles de una ubicación por su ID.
 *       Solo el propietario de la ubicación puede acceder.
 *       Si no existe o no pertenece al usuario, retorna 404.
 *     tags: [Ubicaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: location_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la ubicación
 *     responses:
 *       200:
 *         description: Detalles de la ubicación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LocationResponse'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Ubicación no encontrada o no pertenece al usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LocationNotFoundError'
 *   patch:
 *     summary: Actualizar una ubicación
 *     description: |
 *       Actualiza dirección, coordenadas y/o el marcado como principal.
 *       Todos los campos son opcionales. Al marcar `is_primary: true`,
 *       se quita el flag a las demás ubicaciones del usuario.
 *       Solo el propietario de la ubicación puede modificarla.
 *     tags: [Ubicaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: location_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la ubicación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateLocationRequest'
 *           example:
 *             is_primary: true
 *             address: "Calle Nueva 456, Bogotá"
 *     responses:
 *       200:
 *         description: Ubicación actualizada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UpdateLocationResponse'
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
 *       404:
 *         description: Ubicación no encontrada o no pertenece al usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LocationNotFoundError'
 *   delete:
 *     summary: Eliminar una ubicación
 *     description: |
 *       Elimina una ubicación del usuario.
 *       Solo el propietario de la ubicación puede eliminarla.
 *     tags: [Ubicaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: location_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la ubicación
 *     responses:
 *       200:
 *         description: Ubicación eliminada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Ubicación eliminada correctamente
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Ubicación no encontrada o no pertenece al usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LocationNotFoundError'
 */

/**
 * @openapi
 * /workers/nearby:
 *   get:
 *     summary: Buscar trabajadores disponibles cercanos a un punto
 *     description: |
 *       Retorna trabajadores con perfil certificado (APPROVED) y disponible
 *       (AVAILABLE) dentro de un radio desde una ubicación geográfica.
 *       Usa PostGIS (ST_DistanceSphere + ST_DWithin) para queries espaciales
 *       eficientes y ordena los resultados por distancia ascendente.
 *       Los resultados se cachean en Redis con TTL de 5 minutos.
 *     tags: [Trabajadores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema: { type: number, minimum: -90, maximum: 90 }
 *         description: Latitud del punto de referencia
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema: { type: number, minimum: -180, maximum: 180 }
 *         description: Longitud del punto de referencia
 *       - in: query
 *         name: radius_km
 *         required: true
 *         schema: { type: number, minimum: 1, maximum: 100 }
 *         description: Radio de búsqueda en kilómetros (1 a 100)
 *       - in: query
 *         name: category_id
 *         required: false
 *         schema: { type: string, format: uuid }
 *         description: Filtrar por categoría de servicio
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *         description: Número máximo de resultados (máx. 100, por defecto 20)
 *       - in: query
 *         name: offset
 *         required: false
 *         schema: { type: integer, minimum: 0, default: 0 }
 *         description: Desplazamiento para paginación
 *     responses:
 *       200:
 *         description: Lista de trabajadores cercanos ordenados por distancia
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NearbyWorkersResponse'
 *             example:
 *               workers:
 *                 - worker_id: "a1b2c3d4-..."
 *                   full_name: "Carlos García"
 *                   avatar_url: "https://example.com/avatar.jpg"
 *                   category_name: "Plomería"
 *                   hourly_rate: 35.5
 *                   average_rating: "4.5"
 *                   distance_km: 1.24
 *               count: 1
 *               limit: 20
 *               offset: 0
 *       400:
 *         description: Error de validación de parámetros
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
 */
