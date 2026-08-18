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

        // ── Chat schemas ────────────────────────────────────────────────
        CreateChatRequest: {
          type: 'object',
          required: ['user_id_2'],
          properties: {
            user_id_2: {
              type: 'string',
              format: 'uuid',
              example: 'b2c3d4e5-...',
              description: 'UUID del otro usuario con quien se inicia el chat',
            },
            order_id: {
              type: 'string',
              format: 'uuid',
              example: 'c3d4e5f6-...',
              nullable: true,
              description: 'UUID de la orden asociada al chat (opcional)',
            },
          },
        },
        CreateChatResponse: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            created: {
              type: 'boolean',
              example: true,
              description: 'true si el chat se creó, false si ya existía para la pareja',
            },
            message: { type: 'string', example: 'Chat creado correctamente' },
          },
        },
        MessageResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            sender_id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            content: { type: 'string', example: 'Hola, ¿estás disponible?' },
            message_type: {
              type: 'string',
              example: 'TEXT',
              enum: ['TEXT', 'IMAGE', 'QUOTE'],
            },
            attachment_url: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateMessageRequest: {
          type: 'object',
          properties: {
            message_type: {
              type: 'string',
              enum: ['TEXT', 'IMAGE', 'QUOTE'],
              default: 'TEXT',
              description: 'Tipo de contenido del mensaje',
            },
            content: {
              type: 'string',
              maxLength: 5000,
              description: 'Contenido del mensaje. Requerido para TEXT y QUOTE',
            },
          },
          description:
            'Para mensajes de tipo IMAGE el mensaje se envía como multipart/form-data con el campo file (JPG/PNG, máx 5MB)',
        },
        CreateMessageResponse: {
          type: 'object',
          properties: {
            message: { $ref: '#/components/schemas/MessageResponse' },
          },
          description:
            'Al crear un mensaje se emite por WebSocket el evento message:new a los demás participantes del chat',
        },
        ListMessagesResponse: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: { $ref: '#/components/schemas/MessageResponse' },
              description: 'Mensajes de la página en orden cronológico',
            },
            count: { type: 'integer', example: 50 },
            limit: { type: 'integer', example: 50 },
            offset: { type: 'integer', example: 0 },
          },
        },
        MessageNotFoundError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'MESSAGE_NOT_FOUND' },
            message: { type: 'string', example: 'Mensaje no encontrado' },
            statusCode: { type: 'integer', example: 404 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ChatDetailResponse: {
          type: 'object',
          properties: {
            chat: {
              type: 'object',
              properties: {
                chat_id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
                user_id_1: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
                user_id_2: { type: 'string', format: 'uuid', example: 'b2c3d4e5-...' },
                order_id: { type: 'string', format: 'uuid', nullable: true },
                last_message_at: { type: 'string', format: 'date-time' },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
            messages: {
              type: 'array',
              items: { $ref: '#/components/schemas/MessageResponse' },
              description: 'Últimos 50 mensajes del chat en orden cronológico',
            },
            unread_count: {
              type: 'integer',
              example: 3,
              description: 'Mensajes no leídos del usuario antes de abrir el chat',
            },
          },
        },
        ChatListItem: {
          type: 'object',
          properties: {
            chat_id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            order_id: { type: 'string', format: 'uuid', nullable: true },
            last_message_at: { type: 'string', format: 'date-time' },
            is_favorite: {
              type: 'boolean',
              example: false,
              description: 'Si el usuario marcó este chat como favorito',
            },
            is_archived: {
              type: 'boolean',
              example: false,
              description: 'Si el usuario archivó este chat',
            },
            last_message: {
              type: 'object',
              nullable: true,
              properties: {
                content: { type: 'string', example: 'Hola, ¿estás disponible?' },
                sender_id: { type: 'string', format: 'uuid' },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
            other_user: {
              type: 'object',
              properties: {
                user_id: { type: 'string', format: 'uuid' },
                full_name: { type: 'string', example: 'Carlos García', nullable: true },
                avatar_url: { type: 'string', nullable: true },
              },
            },
            unread_count: {
              type: 'integer',
              example: 2,
              description: 'Mensajes no leídos del usuario en este chat',
            },
          },
        },
        ListChatsResponse: {
          type: 'object',
          properties: {
            chats: {
              type: 'array',
              items: { $ref: '#/components/schemas/ChatListItem' },
            },
            count: { type: 'integer', example: 20 },
            limit: { type: 'integer', example: 20 },
            offset: { type: 'integer', example: 0 },
          },
        },
        ChatNotFoundError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'CHAT_NOT_FOUND' },
            message: { type: 'string', example: 'Chat no encontrado o no tienes acceso a él' },
            statusCode: { type: 'integer', example: 404 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ChatSameUserError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'SAME_USER' },
            message: { type: 'string', example: 'No puedes crear un chat contigo mismo' },
            statusCode: { type: 'integer', example: 400 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        DeleteChatResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Chat eliminado correctamente' },
          },
        },

        // ── Quote schemas ────────────────────────────────────────────────
        QuoteResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            order_id: { type: 'string', format: 'uuid', example: 'c3d4e5f6-...' },
            proposed_price: { type: 'number', example: 35000 },
            proposed_date: { type: 'string', format: 'date', example: '2026-08-20' },
            proposed_time: { type: 'string', example: '14:30' },
            status: {
              type: 'string',
              example: 'PENDING',
              enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
            },
            rejection_reason: {
              type: 'string',
              example: 'El precio supera mi presupuesto',
              nullable: true,
            },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateQuoteRequest: {
          type: 'object',
          required: ['proposed_price', 'proposed_date', 'proposed_time'],
          properties: {
            proposed_price: {
              type: 'number',
              example: 35000,
              description: 'Precio total de la propuesta (valor positivo)',
            },
            proposed_date: {
              type: 'string',
              format: 'date',
              example: '2026-08-20',
              description: 'Fecha estimada del servicio (hoy o futura)',
            },
            proposed_time: {
              type: 'string',
              example: '14:30',
              description: 'Hora estimada en formato HH:mm',
            },
          },
        },
        UpdateQuoteStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
              description:
                'ACCEPTED o REJECTED (solo cliente), CANCELLED (solo el trabajador de la orden)',
            },
            rejection_reason: {
              type: 'string',
              maxLength: 1000,
              example: 'El precio supera mi presupuesto',
              nullable: true,
              description: 'Motivo opcional de rechazo (útil para renegociación)',
            },
          },
        },
        CreateQuoteResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Cotización creada correctamente' },
            quote: { $ref: '#/components/schemas/QuoteResponse' },
          },
        },
        UpdateQuoteStatusResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Estado de cotización actualizado correctamente' },
            quote: { $ref: '#/components/schemas/QuoteResponse' },
          },
        },
        ListQuotesResponse: {
          type: 'object',
          properties: {
            quotes: {
              type: 'array',
              items: { $ref: '#/components/schemas/QuoteResponse' },
            },
            count: { type: 'integer', example: 2 },
          },
        },
        QuoteNotFoundError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'QUOTE_NOT_FOUND' },
            message: {
              type: 'string',
              example: 'Cotización no encontrada o no tienes acceso a ella',
            },
            statusCode: { type: 'integer', example: 404 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        InvalidTransitionError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'INVALID_TRANSITION' },
            message: { type: 'string', example: 'No se puede pasar de ACCEPTED a REJECTED' },
            statusCode: { type: 'integer', example: 409 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        QuoteNotPendingError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'QUOTE_NOT_PENDING' },
            message: {
              type: 'string',
              example: 'Solo se pueden eliminar cotizaciones en estado PENDING',
            },
            statusCode: { type: 'integer', example: 409 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        // ── Order schemas ──────────────────────────────────────────────────────
        CreateOrderRequest: {
          type: 'object',
          required: ['client_id', 'worker_id', 'category_id', 'location_id'],
          properties: {
            client_id: {
              type: 'string',
              format: 'uuid',
              example: '55555555-5555-5555-5555-555555555555',
              description: 'UUID del perfil de cliente (se resuelve desde el usuario autenticado)',
            },
            worker_id: {
              type: 'string',
              format: 'uuid',
              example: '66666666-6666-6666-6666-666666666666',
              description: 'UUID del perfil de trabajador',
            },
            category_id: {
              type: 'string',
              format: 'uuid',
              example: 'b2c3d4e5-...',
              description: 'UUID de la categoría del servicio',
            },
            location_id: {
              type: 'string',
              format: 'uuid',
              example: 'a1b2c3d4-...',
              description: 'UUID de la ubicación del cliente',
            },
            description: {
              type: 'string',
              maxLength: 2000,
              example: 'Reparar fuga de agua en la cocina',
              description: 'Descripción opcional del trabajo solicitado',
              nullable: true,
            },
          },
        },
        CreateOrderResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Orden creada correctamente' },
            order: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid',
                  example: '33333333-3333-3333-3333-333333333333',
                },
                client_id: { type: 'string', format: 'uuid' },
                worker_id: { type: 'string', format: 'uuid' },
                category_id: { type: 'string', format: 'uuid' },
                location_id: { type: 'string', format: 'uuid' },
                description: { type: 'string', nullable: true },
                status: {
                  type: 'string',
                  example: 'PENDING',
                  enum: [
                    'PENDING',
                    'ACCEPTED',
                    'IN_PROGRESS',
                    'COMPLETED',
                    'REJECTED',
                    'CANCELLED',
                  ],
                },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        OrderResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '33333333-3333-3333-3333-333333333333' },
            client_id: { type: 'string', format: 'uuid' },
            worker_id: { type: 'string', format: 'uuid' },
            category_id: { type: 'string', format: 'uuid' },
            location_id: { type: 'string', format: 'uuid' },
            description: { type: 'string', nullable: true },
            status: {
              type: 'string',
              example: 'PENDING',
              enum: ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'],
            },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            client: {
              type: 'object',
              nullable: true,
              properties: {
                user_id: { type: 'string', format: 'uuid' },
                full_name: { type: 'string' },
                avatar_url: { type: 'string', nullable: true },
              },
            },
            worker: {
              type: 'object',
              nullable: true,
              properties: {
                user_id: { type: 'string', format: 'uuid' },
                full_name: { type: 'string' },
                avatar_url: { type: 'string', nullable: true },
              },
            },
            quotes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  order_id: { type: 'string', format: 'uuid' },
                  proposed_price: { type: 'number', example: 150000 },
                  proposed_date: { type: 'string', format: 'date', example: '2026-08-20' },
                  proposed_time: {
                    type: 'string',
                    pattern: '^([01]\\d|2[0-3]):[0-5]\\d',
                    example: '14:30',
                  },
                  status: {
                    type: 'string',
                    example: 'PENDING',
                    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
                  },
                  rejection_reason: { type: 'string', nullable: true },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        OrderDetailResponse: {
          type: 'object',
          properties: {
            order: { $ref: '#/components/schemas/OrderResponse' },
          },
        },
        ListOrdersResponse: {
          type: 'object',
          properties: {
            orders: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderResponse' },
            },
            count: { type: 'integer', example: 42 },
            limit: { type: 'integer', example: 20 },
            offset: { type: 'integer', example: 0 },
          },
        },
        OrderNotFoundError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'ORDER_NOT_FOUND' },
            message: { type: 'string', example: 'Orden no encontrada o no tienes acceso a ella' },
            statusCode: { type: 'integer', example: 404 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        SameUserError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'SAME_USER' },
            message: {
              type: 'string',
              example: 'El cliente y el trabajador no pueden ser el mismo usuario',
            },
            statusCode: { type: 'integer', example: 400 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        UpdateOrderStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'],
              example: 'ACCEPTED',
              description: 'Nuevo estado de la orden',
            },
          },
        },
        PaymentAlreadyStartedError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'PAYMENT_ALREADY_STARTED' },
            message: { type: 'string', example: 'Ya existe un pago iniciado para esta orden' },
            statusCode: { type: 'integer', example: 409 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        OrderNotActiveError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'ORDER_NOT_ACTIVE' },
            message: {
              type: 'string',
              example: 'La orden no está en un estado en el que se pueda cotizar',
            },
            statusCode: { type: 'integer', example: 409 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },

        // ── Rating schemas ──────────────────────────────────────────────
        RatingResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            order_id: { type: 'string', format: 'uuid', example: 'c3d4e5f6-...' },
            rater_id: { type: 'string', format: 'uuid', example: '11111111-...' },
            ratee_id: { type: 'string', format: 'uuid', example: '22222222-...' },
            rating_stars: { type: 'integer', example: 5, minimum: 1, maximum: 5 },
            review_text: {
              type: 'string',
              example: 'Excelente trabajo, muy profesional',
              nullable: true,
            },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateRatingRequest: {
          type: 'object',
          required: ['order_id', 'rating_stars'],
          properties: {
            order_id: {
              type: 'string',
              format: 'uuid',
              example: 'c3d4e5f6-...',
              description: 'UUID de la orden completada a calificar',
            },
            rating_stars: {
              type: 'integer',
              example: 5,
              minimum: 1,
              maximum: 5,
              description: 'Calificación en estrellas (1-5)',
            },
            review_text: {
              type: 'string',
              example: 'Excelente trabajo, muy profesional',
              maxLength: 1000,
              nullable: true,
              description: 'Reseña opcional (máx. 1000 caracteres)',
            },
          },
        },
        CreateRatingResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Calificación creada correctamente' },
            rating: { $ref: '#/components/schemas/RatingResponse' },
          },
        },
        RatingListItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            order_id: { type: 'string', format: 'uuid', example: 'c3d4e5f6-...' },
            rater_id: { type: 'string', format: 'uuid', example: '11111111-...' },
            ratee_id: { type: 'string', format: 'uuid', example: '22222222-...' },
            rating_stars: { type: 'integer', example: 5, minimum: 1, maximum: 5 },
            review_text: { type: 'string', example: 'Excelente trabajo', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            rater: {
              type: 'object',
              properties: {
                user_id: { type: 'string', format: 'uuid' },
                full_name: { type: 'string', example: 'Juan Pérez' },
                avatar_url: { type: 'string', nullable: true },
              },
            },
          },
        },
        ListRatingsResponse: {
          type: 'object',
          properties: {
            ratings: {
              type: 'array',
              items: { $ref: '#/components/schemas/RatingListItem' },
            },
            count: { type: 'integer', example: 10 },
            limit: { type: 'integer', example: 20 },
            offset: { type: 'integer', example: 0 },
          },
        },
        RatingAverageResponse: {
          type: 'object',
          properties: {
            average_rating: {
              type: 'number',
              example: 4.5,
              nullable: true,
              description: 'Promedio de estrellas (redondeado a 1 decimal)',
            },
            total_ratings: {
              type: 'integer',
              example: 10,
              description: 'Total de calificaciones recibidas',
            },
          },
        },
        AlreadyRatedError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'ALREADY_RATED' },
            message: {
              type: 'string',
              example: 'Ya existe una calificación para esta orden por parte de este usuario',
            },
            statusCode: { type: 'integer', example: 409 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        OrderNotCompletedError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'ORDER_NOT_COMPLETED' },
            message: {
              type: 'string',
              example: 'Solo se pueden calificar órdenes en estado COMPLETED',
            },
            statusCode: { type: 'integer', example: 409 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Dispute: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            order_id: { type: 'string', format: 'uuid', example: 'c3d4e5f6-...' },
            opened_by_id: { type: 'string', format: 'uuid', example: 'd4e5f6a7-...' },
            reason: {
              type: 'string',
              example: 'El servicio no se completó de acuerdo a lo acordado',
            },
            evidence_url: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: 'https://example.com/evidence.jpg',
            },
            status: {
              type: 'string',
              enum: ['OPEN', 'RESOLVED', 'CLOSED'],
              example: 'OPEN',
            },
            resolution_notes: {
              type: 'string',
              nullable: true,
              example: 'Reembolso aprobado a favor del cliente',
            },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        WorkerAvailability: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            worker_id: { type: 'string', format: 'uuid', example: 'c3d4e5f6-...' },
            day_of_week: {
              type: 'integer',
              minimum: 0,
              maximum: 6,
              example: 1,
              description: 'Día de la semana, 0 (Domingo) a 6 (Sábado)',
            },
            start_time: { type: 'string', example: '09:00' },
            end_time: { type: 'string', example: '13:00' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
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
/**
 * @openapi
 * /chats:
 *   post:
 *     summary: Crear o recuperar un chat entre dos usuarios
 *     description: |
 *       Crea un chat entre el usuario autenticado y `user_id_2`. Solo se permite
 *       un chat por pareja: si el chat ya existe, se devuelve el mismo `chat_id`
 *       con `created: false` y se reactiva el chat si el usuario lo había eliminado.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateChatRequest'
 *           example:
 *             user_id_2: "b2c3d4e5-..."
 *             order_id: "c3d4e5f6-..."
 *     responses:
 *       201:
 *         description: Chat creado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateChatResponse'
 *       200:
 *         description: El chat de la pareja ya existía, se retorna el existente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateChatResponse'
 *             example:
 *               chat_id: "a1b2c3d4-..."
 *               created: false
 *               message: "El chat ya existe"
 *       400:
 *         description: Error de validación o intento de chat consigo mismo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatSameUserError'
 *       404:
 *         description: Uno de los usuarios no existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *
 * /chats/{chat_id}:
 *   get:
 *     summary: Obtener un chat con sus últimos 50 mensajes
 *     description: |
 *       Retorna el chat y los últimos 50 mensajes en orden cronológico.
 *       Marca como leídos los mensajes del otro participante (`last_read_at` se actualiza).
 *       El usuario debe ser participante del chat.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chat_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del chat
 *     responses:
 *       200:
 *         description: Detalle del chat con mensajes y no-leídos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatDetailResponse'
 *       404:
 *         description: Chat no encontrado o sin acceso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatNotFoundError'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *   delete:
 *     summary: Eliminar un chat (soft delete)
 *     description: |
 *       Marca `deleted_at` en la participación del usuario autenticado.
 *       El chat deja de aparecer solo en el listado de quien lo elimina;
 *       el otro participante puede seguir viéndolo.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chat_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del chat
 *     responses:
 *       200:
 *         description: Chat eliminado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteChatResponse'
 *       404:
 *         description: Chat no encontrado o sin acceso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatNotFoundError'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *
 * /users/{id}/chats:
 *   get:
 *     summary: Listar chats del usuario con filtros y paginación
 *     description: |
 *       Lista los chats del usuario autenticado (no eliminados por él), ordenados primero
 *       por favoritos y luego por `last_message_at` descendente (más recientes primero).
 *       Incluye el último mensaje, la información del otro usuario, el conteo de no leídos
 *       y el estado de favorito/archivado. Permite filtrar por estado y buscar por nombre.
 *
 *       Filtros de estado (`status`):
 *       - `all` (default): todos los chats no archivados.
 *       - `favorites`: solo chats marcados como favoritos y no archivados.
 *       - `active`: solo chats con una orden vinculada en curso
 *         (`PENDING`, `ACCEPTED`, `IN_PROGRESS`).
 *       - `archived`: solo chats archivados por el usuario.
 *
 *       `search` filtra por nombre del otro usuario (ILIKE). Paginación con `limit`
 *       (default 20, máx 100) y `offset`.
 *     tags: [Chats]
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
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [all, favorites, active, archived]
 *           default: all
 *         description: Filtro por estado del chat
 *       - in: query
 *         name: search
 *         required: false
 *         schema: { type: string, maxLength: 100 }
 *         description: Busca por nombre del otro usuario del chat
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *         description: Número máximo de chats por página
 *       - in: query
 *         name: offset
 *         required: false
 *         schema: { type: integer, minimum: 0, default: 0 }
 *         description: Desplazamiento para paginación
 *     responses:
 *       200:
 *         description: Lista paginada de chats del usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListChatsResponse'
 *             example:
 *               chats:
 *                 - chat_id: "a1b2c3d4-..."
 *                   last_message_at: "2026-08-07T13:00:00Z"
 *                   is_favorite: true
 *                   is_archived: false
 *                   last_message:
 *                     content: "Hola, ¿estás disponible?"
 *                     sender_id: "b2c3d4e5-..."
 *                     created_at: "2026-08-07T13:00:00Z"
 *                   other_user:
 *                     user_id: "b2c3d4e5-..."
 *                     full_name: "Carlos García"
 *                     avatar_url: null
 *                   unread_count: 2
 *               count: 1
 *               limit: 20
 *               offset: 0
 *       400:
 *         description: Error de validación de parámetros de paginación o filtros
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
 *         description: No autorizado para ver los chats de otro usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 */
/**
 * @openapi
 * /chats/{chat_id}/messages:
 *   post:
 *     summary: Enviar un mensaje en un chat
 *     description: |
 *       Crea un mensaje en el chat. El usuario autenticado debe ser participante
 *       activo del chat. Soporta `TEXT`, `QUOTE` (JSON) e `IMAGE`
 *       (`multipart/form-data` con el campo `file`, JPG/PNG, máx 5MB; la imagen
 *       se comprime y valida antes de almacenarse en `/uploads/messages/`).
 *       Al crearse, se emite por WebSocket el evento `message:new` a los demás
 *       participantes. Cada mensaje incluye su timestamp (`created_at`).
 *     tags: [Mensajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chat_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMessageRequest'
 *           example:
 *             message_type: "TEXT"
 *             content: "Hola, ¿cuándo puedes comenzar?"
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               message_type: { type: string, enum: [TEXT, IMAGE, QUOTE], default: TEXT }
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Imagen JPG/PNG (máx 5MB), obligatoria para IMAGE
 *     responses:
 *       201:
 *         description: Mensaje creado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateMessageResponse'
 *       400:
 *         description: Validación, archivo faltante/inválido o excede 5MB
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
 *         description: Chat no encontrado o el usuario no participa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatNotFoundError'
 *   get:
 *     summary: Listar mensajes de un chat (paginado)
 *     description: |
 *       Obtiene los mensajes del chat de forma paginada (default 50 por página,
 *       máx 100). Al cargar la conversación, los mensajes del usuario se marcan
 *       como leídos (`chat_participants.last_read_at`). Los mensajes eliminados
 *       no se incluyen.
 *     tags: [Mensajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chat_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del chat
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
 *         description: Número máximo de mensajes por página
 *       - in: query
 *         name: offset
 *         required: false
 *         schema: { type: integer, minimum: 0, default: 0 }
 *         description: Desplazamiento para paginación
 *     responses:
 *       200:
 *         description: Lista paginada de mensajes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListMessagesResponse'
 *       400:
 *         description: Parámetros de paginación inválidos
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
 *         description: Chat no encontrado o el usuario no participa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatNotFoundError'
 */
/**
 * @openapi
 * /messages/{message_id}:
 *   delete:
 *     summary: Eliminar un mensaje
 *     description: |
 *       Elimina (soft delete) un mensaje. Solo el autor del mensaje puede
 *       eliminarlo. Al eliminarse, se emite por WebSocket el evento
 *       `message:deleted` a los demás participantes del chat.
 *     tags: [Mensajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: message_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del mensaje a eliminar
 *     responses:
 *       200:
 *         description: Mensaje eliminado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Mensaje eliminado correctamente }
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Solo el autor puede eliminar el mensaje
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Mensaje no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageNotFoundError'
 */
/**
 * @openapi
 * /ws:
 *   get:
 *     summary: Conexión WebSocket en tiempo real
 *     description: |
 *       Conexión WebSocket para real-time messaging. El cliente se conecta al
 *       iniciar la aplicación con el access token como query param:
 *       `ws://<host>/ws?token=<accessToken>`. Al autenticarse recibe
 *       `{ "event": "connected", "payload": { "user_id": "..." } }`.
 *
 *       Eventos enviados por el servidor al cliente:
 *       - `message:new` → `{ event, payload: { chat_id, message } }` cuando hay
 *         un nuevo mensaje en un chat del usuario.
 *       - `message:deleted` → `{ event, payload: { chat_id, message_id } }`
 *         cuando un mensaje del chat es eliminado.
 *       - `user:typing` → `{ event, payload: { chat_id, user_id, is_typing } }`
 *         cuando otro usuario escribe.
 *
 *       Evento que el cliente envía al servidor:
 *       - `user:typing` → `{ type: "user:typing", chat_id, is_typing }` para
 *         notificar que está escribiendo (el servidor lo reenvía a los demás
 *         participantes del chat).
 *     tags: [Mensajes]
 */
/**
 * @openapi
 * /orders/{order_id}/quotes:
 *   post:
 *     summary: Crear una cotización para una orden
 *     description: |
 *       Permite al trabajador asignado a la orden enviar una propuesta de tarifa
 *       y agenda (`proposed_price`, `proposed_date`, `proposed_time`).
 *       Solo el trabajador de la orden puede crear cotizaciones y la orden debe
 *       estar activa (PENDING, ACCEPTED o IN_PROGRESS). La cotización se crea
 *       en estado `PENDING`.
 *     tags: [Cotizaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la orden
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateQuoteRequest'
 *           example:
 *             proposed_price: 35000
 *             proposed_date: "2026-08-20"
 *             proposed_time: "14:30"
 *     responses:
 *       201:
 *         description: Cotización creada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateQuoteResponse'
 *       400:
 *         description: Error de validación (precio no positivo, fecha pasada o hora inválida)
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
 *         description: No autorizado (no es el trabajador asignado o rol incorrecto)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Orden no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       409:
 *         description: La orden no está activa para cotizar
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderNotActiveError'
 *   get:
 *     summary: Listar las cotizaciones de una orden
 *     description: |
 *       Retorna todas las cotizaciones de la orden en orden cronológico.
 *       Accesible solo para el cliente o el trabajador de la orden.
 *     tags: [Cotizaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la orden
 *     responses:
 *       200:
 *         description: Lista de cotizaciones de la orden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListQuotesResponse'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: No autorizado para ver las cotizaciones de esta orden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Orden no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *
 * /quotes/{quote_id}:
 *   get:
 *     summary: Obtener detalles de una cotización
 *     description: |
 *       Retorna el detalle de una cotización. Accesible solo para el cliente o
 *       el trabajador de la orden asociada.
 *     tags: [Cotizaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quote_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la cotización
 *     responses:
 *       200:
 *         description: Detalle de la cotización
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuoteResponse'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Cotización no encontrada o sin acceso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuoteNotFoundError'
 *   patch:
 *     summary: Aceptar, rechazar o cancelar una cotización
 *     description: |
 *       Cambia el estado de una cotización `PENDING`. Máquina de estados:
 *       - `PENDING → ACCEPTED` o `PENDING → REJECTED`: solo el cliente de la
 *         orden. Al aceptar, la orden pasa a `ACCEPTED`, las demás cotizaciones
 *         pendientes se rechazan y se inicia el proceso de pago creando la
 *         transacción (escrow) en estado `PENDING`.
 *       - `PENDING → CANCELLED`: solo el trabajador de la orden (retira su propuesta).
 *
 *       `rejection_reason` es opcional y se guarda al rechazar (permite renegociar).
 *     tags: [Cotizaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quote_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la cotización
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateQuoteStatusRequest'
 *           examples:
 *             aceptar:
 *               summary: Aceptar la cotización
 *               value:
 *                 status: ACCEPTED
 *             rechazar:
 *               summary: Rechazar con motivo (renegociación)
 *               value:
 *                 status: REJECTED
 *                 rejection_reason: "El precio supera mi presupuesto"
 *     responses:
 *       200:
 *         description: Estado de cotización actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UpdateQuoteStatusResponse'
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
 *         description: No autorizado (cliente solo acepta/rechaza, trabajador solo cancela)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Cotización no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuoteNotFoundError'
 *       409:
 *         description: Transición inválida o pago ya iniciado para la orden
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/InvalidTransitionError'
 *                 - $ref: '#/components/schemas/PaymentAlreadyStartedError'
 *   delete:
 *     summary: Eliminar una cotización
 *     description: |
 *       Elimina una cotización. Solo el trabajador de la orden puede eliminarla
 *       y únicamente mientras esté en estado `PENDING`.
 *     tags: [Cotizaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quote_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la cotización
 *     responses:
 *       200:
 *         description: Cotización eliminada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Cotización eliminada correctamente
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: No autorizado (no es el trabajador de la orden)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Cotización no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuoteNotFoundError'
 *       409:
 *         description: La cotización no está en estado PENDING
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuoteNotPendingError'
 */

/**
 * @openapi
 * /orders:
 *   post:
 *     summary: Crear una nueva orden
 *     description: |
 *       Crea una orden de servicio con estado PENDING. El usuario autenticado debe
 *       tener perfil de cliente y será el cliente de la orden. Valida que:
 *       - `worker_id` corresponde a un perfil de trabajador válido.
 *       - `category_id` existe y está activa.
 *       - `location_id` pertenece al cliente que crea la orden.
 *       - `client_id` (perfil del cliente) y `worker_id` no sean el mismo usuario.
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderRequest'
 *           example:
 *             client_id: "55555555-5555-5555-5555-555555555555"
 *             worker_id: "66666666-6666-6666-6666-666666666666"
 *             category_id: "b2c3d4e5-..."
 *             location_id: "a1b2c3d4-..."
 *             description: "Reparar fuga de agua en la cocina"
 *     responses:
 *       201:
 *         description: Orden creada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateOrderResponse'
 *       400:
 *         description: Error de validación o el cliente y trabajador son el mismo usuario
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ValidationError'
 *                 - $ref: '#/components/schemas/SameUserError'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Trabajador, categoría o ubicación no encontrados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *   get:
 *     summary: Listar órdenes del usuario autenticado
 *     description: |
 *       Retorna las órdenes donde el usuario participa como cliente o trabajador,
 *       ordenadas por `created_at` descendente. Soporta paginación
 *       (`limit` default 20, máx 100; `offset` default 0) y filtros:
 *       - `status`: filtra por estado de la orden.
 *       - `role`: `MINE_AS_CLIENT` o `MINE_AS_WORKER` para acotar por rol del usuario.
 *       - `date_from` / `date_to`: rango de fechas de creación (ISO `YYYY-MM-DD`).
 *       Cada orden incluye info del cliente/trabajador y sus cotizaciones.
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *         description: Número máximo de órdenes por página
 *       - in: query
 *         name: offset
 *         required: false
 *         schema: { type: integer, minimum: 0, default: 0 }
 *         description: Desplazamiento para paginación
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, REJECTED, CANCELLED]
 *         description: Filtrar por estado de la orden
 *       - in: query
 *         name: role
 *         required: false
 *         schema:
 *           type: string
 *           enum: [MINE_AS_CLIENT, MINE_AS_WORKER]
 *         description: Filtrar por rol del usuario en la orden
 *       - in: query
 *         name: date_from
 *         required: false
 *         schema: { type: string, format: date }
 *         description: Fecha mínima de creación (ISO YYYY-MM-DD)
 *       - in: query
 *         name: date_to
 *         required: false
 *         schema: { type: string, format: date }
 *         description: Fecha máxima de creación (ISO YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Lista paginada de órdenes del usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListOrdersResponse'
 *       400:
 *         description: Parámetros de consulta inválidos
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
 *
 * /orders/{id}:
 *   get:
 *     summary: Obtener detalles de una orden
 *     description: |
 *       Retorna el detalle de una orden si el usuario autenticado participa en ella
 *       (como cliente o trabajador). Incluye información del cliente, del trabajador
 *       y la lista de cotizaciones asociadas.
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la orden
 *     responses:
 *       200:
 *         description: Detalle de la orden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderDetailResponse'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Orden no encontrada o sin acceso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderNotFoundError'
 *
 * /orders/{id}/status:
 *   patch:
 *     summary: Actualizar el estado de una orden (máquina de estados)
 *     description: |
 *       Cambia el estado de la orden respetando la máquina de estados:
 *       `PENDING → ACCEPTED | REJECTED`, `ACCEPTED → IN_PROGRESS | CANCELLED`,
 *       `IN_PROGRESS → COMPLETED | CANCELLED`.
 *       Solo usuarios permitidos pueden cambiar estado: el cliente acepta/rechaza,
 *       el trabajador inicia/completa, y ambos pueden cancelar. Cada transición
 *       exitosa registra un evento en `order_events` y emite `order:status_changed`
 *       vía WebSocket. Las transiciones a COMPLETED/CANCELLED disparan la lógica de escrow.
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la orden
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateOrderStatusRequest'
 *           example:
 *             status: ACCEPTED
 *     responses:
 *       200:
 *         description: Estado de orden actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Estado de orden actualizado correctamente
 *                 order:
 *                   $ref: '#/components/schemas/OrderDetailResponse'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: No autorizado para realizar esta transición
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Orden no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderNotFoundError'
 *       409:
 *         description: Transición de estado inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvalidTransitionError'
 *
 * /orders/{id}/history:
 *   get:
 *     summary: Obtener el historial de una orden
 *     description: |
 *       Retorna el historial de auditoría (cambios de estado) de una orden.
 *       Accesible solo para el cliente o el trabajador de la orden.
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la orden
 *     responses:
 *       200:
 *         description: Historial de la orden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       order_id:
 *                         type: string
 *                         format: uuid
 *                       user_id:
 *                         type: string
 *                         format: uuid
 *                       from_state:
 *                         type: string
 *                       to_state:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: No autorizado para ver el historial de esta orden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Orden no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderNotFoundError'
 */

/**
 * @openapi
 * /orders/{id}/complete:
 *   post:
 *     summary: Confirmar la finalización del servicio
 *     description: |
 *       Permite al cliente o trabajador confirmar que el servicio ha finalizado.
 *       Se requiere confirmación dual:
 *       - **Cliente (obligatorio)**: debe confirmar la finalización.
 *       - **Trabajador (opcional)**: puede confirmar, pero no es obligatorio.
 *
 *       Cuando **ambas partes confirman**, la orden transiciona a `COMPLETED`
 *       y se libera el escrow (fondos retenidos) al trabajador.
 *
 *       La orden debe estar en estado `IN_PROGRESS`.
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la orden
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confirm:
 *                 type: boolean
 *                 default: true
 *                 description: |
 *                   Si es `true` (por defecto), confirma la finalización.
 *                   Si es `false`, revoca la confirmación previa.
 *             example:
 *               confirm: true
 *     responses:
 *       200:
 *         description: Confirmación registrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Confirmación registrada. Se requiere la confirmación de ambas partes"
 *                 order:
 *                   $ref: '#/components/schemas/OrderResponse'
 *                 bothConfirmed:
 *                   type: boolean
 *                   example: false
 *                   description: Indica si ambas partes ya confirmaron
 *                 clientConfirmed:
 *                   type: boolean
 *                   example: true
 *                   description: Indica si el cliente confirmó
 *                 workerConfirmed:
 *                   type: boolean
 *                   example: false
 *                   description: Indica si el trabajador confirmó
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: No autorizado (no es cliente ni trabajador de la orden)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Orden no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderNotFoundError'
 *       409:
 *         description: Conflicto (orden no en IN_PROGRESS, ya confirmado, transición inválida)
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/InvalidTransitionError'
 *                 - type: object
 *                   properties:
 *                     error: { type: string, example: 'ALREADY_CONFIRMED' }
 *                     message: { type: string, example: 'El cliente ya confirmó la finalización' }
 *                     statusCode: { type: integer, example: 409 }
 *                     timestamp: { type: string, format: 'date-time' }
 */
/**
 * @openapi
 * /ratings:
 *   post:
 *     summary: Crear una calificación para una orden completada
 *     description: |
 *       Permite al cliente o trabajador calificar la orden completada.
 *       Solo participantes de la orden (cliente o trabajador) pueden calificar.
 *       La orden debe estar en estado COMPLETED.
 *       Máximo un rating por usuario por orden (constraint UNIQUE).
 *       Se actualiza automáticamente el average_rating en el perfil del calificado.
 *     tags: [Calificaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRatingRequest'
 *           example:
 *             order_id: "c3d4e5f6-..."
 *             rating_stars: 5
 *             review_text: "Excelente trabajo, muy profesional"
 *     responses:
 *       201:
 *         description: Calificación creada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateRatingResponse'
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
 *         description: No es cliente ni trabajador de la orden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Orden no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderNotFoundError'
 *       409:
 *         description: Orden no completada o ya existe un rating del usuario para esta orden
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/OrderNotCompletedError'
 *                 - $ref: '#/components/schemas/AlreadyRatedError'
 *
 * /users/{id}/ratings:
 *   get:
 *     summary: Listar calificaciones recibidas por un usuario
 *     description: |
 *       Retorna las calificaciones donde el usuario es el calificado (ratee).
 *       Incluye información del calificador (rater).
 *       Soporta paginación con limit (default 20, max 100) y offset.
 *     tags: [Calificaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del usuario calificado
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *         description: Número máximo de calificaciones por página
 *       - in: query
 *         name: offset
 *         required: false
 *         schema: { type: integer, minimum: 0, default: 0 }
 *         description: Desplazamiento para paginación
 *     responses:
 *       200:
 *         description: Lista paginada de calificaciones recibidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListRatingsResponse'
 *       400:
 *         description: Parámetros de consulta inválidos
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
 *
 * /users/{id}/rating-average:
 *   get:
 *     summary: Obtener el promedio de calificaciones de un usuario
 *     description: |
 *       Calcula y retorna el promedio de estrellas recibidas por el usuario
 *       y el total de calificaciones recibidas.
 *     tags: [Calificaciones]
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
 *         description: Promedio de calificaciones del usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RatingAverageResponse'
 *       401:
 *         description: Token no proporcionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 */
