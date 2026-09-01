# Backend Service - Digital On-Demand Platform

Servicio Backend RESTful construido en Node.js, Express y TypeScript.

## 🚀 Requisitos Previos

- **Node.js**: v18 o superior
- **Docker** y **Docker Compose** (para PostgreSQL)
- **npm** o **yarn**

## 🔧 Configuración Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   ```bash
   cp .env.example .env
   ```
   *Edita `.env` si es necesario.*


3. Levantar el entorno de base de datos (PostgreSQL/PostGIS):
   *(Configura y levanta tu contenedor de base de datos local)*

4. Iniciar el proyecto:
   ```bash
   npm run dev
   ```


## 🛠️ Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo utilizando `nodemon` en caliente sobre `src/server.js`.
- `npm start`: Inicia el servidor en producción utilizando Node.js nativo sobre `src/server.js`.
- `npm run format`: Formatea el código de manera automática utilizando `Prettier`.
- `npm run format:check`: Verifica si hay desviaciones en las reglas del formateador de código.
- `npm test`: Ejecuta la suite de pruebas unitarias con `Jest` y genera el reporte de cobertura en `coverage/`.
- `npm run seed` / `npm run seed:dev`: Puebla la base de datos con datos iniciales (32 categorías, 10 usuarios de test, ubicaciones, órdenes en varios estados, cotizaciones, escrow y ratings).
- `npm run seed:clear`: Limpia de forma atómica y ordenada todas las tablas de prueba de la base de datos.

## 🌱 Población de Datos Iniciales (Seeds)

El proyecto incluye un set completo de seeds modulares con Knex.js y scripts de limpieza atómica para facilitar el desarrollo local, pruebas manuales, testing automatizado e integración con el Frontend.

### 🚀 Comandos Rápidos

| Comando | Descripción |
|---|---|
| `npm run seed` | Limpia la BD y siembra el dataset completo de desarrollo |
| `npm run seed:dev` | Alias equivalente a `npm run seed` |
| `npm run seed:clear` | Ejecuta `clear.js` para limpiar y vaciar atómicamente todas las tablas |

```bash
# Poblar la base de datos
npm run seed

# Limpiar toda la base de datos (Reset)
npm run seed:clear
```

---

### 👥 Usuarios de Prueba Sembrados

> **Contraseña universal para todas las cuentas de prueba:** `test123!`  
> Todos los usuarios cuentan con email y teléfono verificados (`is_verified: true`, `active: true`).

#### 1. Clientes de Test
| Email | Contraseña | Nombre Completo | Teléfono | Ubicación (CABA) | Tarjeta Guardada |
|---|---|---|---|---|---|
| `cliente1@test.com` | `test123!` | Juan Carlos Pérez | `+5491144441111` | Av. Santa Fe 3200, Palermo | Visa `**** 4242` |
| `cliente2@test.com` | `test123!` | María Eugenia González | `+5491144442222` | Av. Cabildo 2100, Belgrano | Mastercard `**** 5555` |
| `cliente3@test.com` | `test123!` | Lucas Rodríguez | `+5491144443333` | Av. Rivadavia 5400, Caballito | Visa `**** 1234` |
| `cliente4@test.com` | `test123!` | Sofía Martínez | `+5491144444444` | Av. Callao 1400, Recoleta | Visa `**** 8888` |
| `cliente5@test.com` | `test123!` | Carlos Alberto Gómez | `+5491144445555` | Av. Triunvirato 4500, Villa Urquiza | Mastercard `**** 7777` |

#### 2. Trabajadores de Test (Rol Dual)
| Email | Contraseña | Nombre Completo | Especialidad / Categoría | Tarifa/Hora | Certificaciones | Ubicación (CABA) |
|---|---|---|---|---|---|---|
| `worker1@test.com` | `test123!` | Roberto Fernández | Plomería | $8.500 | Matrícula + DNI (Aprobados) | Villa Crespo |
| `worker2@test.com` | `test123!` | Diego Álvarez | Electricidad | $9.500 | Matrícula COPIME + DNI (Aprobados) | Belgrano |
| `worker3@test.com` | `test123!` | Laura Benítez | Limpieza | $6.500 | Antecedentes + DNI (Aprobados) | Recoleta |
| `worker4@test.com` | `test123!` | Martín Díaz | Pintura | $7.500 | Antecedentes + DNI (Aprobados) | Villa del Parque |
| `worker5@test.com` | `test123!` | Esteban Rossi | Climatización | $11.000 | Matrícula Climatización + DNI (Aprobados) | Coghlan |

---

### 📦 Órdenes de Ejemplo en Diferentes Estados

| ID Orden | Estado | Cliente | Trabajador | Categoría | Cotización | Escrow / Pago |
|---|---|---|---|---|---|---|
| `c1111111-...` | `PENDING` | Juan Carlos Pérez | Roberto Fernández | Plomería | $15.000 (Pendiente) | Sin transacción |
| `c2222222-...` | `ACCEPTED` | María E. González | Diego Álvarez | Electricidad | $25.000 (Aceptada) | `ESCROWED` ($25.000 retenidos) |
| `c3333333-...` | `IN_PROGRESS` | Lucas Rodríguez | Laura Benítez | Limpieza | $32.000 (Aceptada) | `ESCROWED` ($32.000 retenidos) |
| `c4444444-...` | `COMPLETED` | Sofía Martínez | Martín Díaz | Pintura | $65.000 (Aceptada) | `COMPLETED` (Fondos liberados al trabajador) |
| `c5555555-...` | `COMPLETED` | Carlos A. Gómez | Esteban Rossi | Climatización | $85.000 (Aceptada) | `COMPLETED` (Fondos liberados al trabajador) |
| `c6666666-...` | `CANCELLED` | Juan Carlos Pérez | Diego Álvarez | Electricidad | $18.000 (Cancelada) | Cancelada |
| `c7777777-...` | `REJECTED` | María E. González | Martín Díaz | Pintura | $220.000 (Rechazada) | Rechazada por cliente |

---

### 🗂️ Categorías de Servicios Sembradas (32 en total)

1. Limpieza
2. Plomería
3. Electricidad
4. Jardinería y Paisajismo
5. Pintura
6. Carpintería
7. Climatización y Refrigeración
8. Cuidado de Mascotas
9. Soporte Técnico e Informática
10. Cerrajería
11. Gasista Matriculado
12. Mudanzas y Fletes
13. Albañilería y Construcción
14. Herrería y Soldadura
15. Techista y Reparación de Techos
16. Fumigación y Control de Plagas
17. Seguridad y Cámaras (CCTV)
18. Reparación de Electrodomésticos
19. Durlock y Yesería
20. Tapicería y Restauración
21. Pulido y Plastificado de Pisos
22. Impermeabilización
23. Cuidado de Adultos Mayores
24. Cuidado Infantil y Niñera
25. Clases Particulares
26. Diseño y Decoración de Interiores
27. Organización de Espacios
28. Peluquería y Barbería a Domicilio
29. Masajes y Estética
30. Catering y Chef a Domicilio
31. Mantenimiento de Piletas / Piscinas
32. Vidriería y Cerramientos

---

### 💡 Ejemplo de Uso con cURL

```bash
# Iniciar sesión con un cliente sembrado
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente1@test.com",
    "password": "test123!"
  }'

# Iniciar sesión con un trabajador sembrado
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "worker1@test.com",
    "password": "test123!"
  }'
```



## 🧪 Testing y Cobertura

- **Stack**: Jest 29 + `supertest` con **Babel** (`@babel/preset-env`, targets `node: current`, `modules: false` para conservar ESM nativo — ver `babel.config.json` y `transform` en `jest.config.js`).
- La suite cubre **servicios críticos** (auth, pagos, órdenes, chat, escrow), máquina de estados de órdenes, validaciones de entrada (Joi), utilidades (cifrado, caché) y casos de error/edge.
- `npm test` ejecuta `--coverage` y **falla si no se alcanza el umbral mínimo** definido en `jest.config.js`:

| Métrica | Mínimo |
|---|---|
| Statements / Lines (capa crítica) | 70% |
| Branches (capa crítica) | 55% |
| Functions (capa crítica) | 60% |

- Archivos críticos con umbral propio del 70% (statements, functions, lines): `AuthService`, `PaymentService`, `OrderService`, `ChatService`, `EscrowService` y `src/utils/validation.js`.
- **Alcance del reporte**: `src/services/*.js` y `src/utils/**/*.js`. Los adaptadores de proveedores externos (`src/services/providers/**`), los controllers/routes (vía HTTP) y la plomería de middleware quedan fuera del reporte por considerarse lógica de baja criticidad / dependencias de terceros.
- El reporte HTML se genera en `coverage/lcov-report/index.html` (el directorio `coverage/` está en `.gitignore`).
- El CI ejecuta `format:check` + `npm test` en cada Pull Request, por lo que la cobertura mínima se valida automáticamente.

## 📂 Estructura del Directorio

```
├── config/             # Archivos de configuración general
├── docs/               # Documentación técnica y diagramas
├── src/
│   ├── controllers/    # Controladores de la API (HTTP endpoints)
│   ├── middlewares/    # Middlewares de Express (Auth, Rate Limiting, etc.)
│   ├── models/         # Modelos de base de datos y esquemas
│   ├── routes/         # Definición de rutas Express
│   ├── services/       # Lógica de negocio core
│   ├── utils/          # Utilidades y funciones helper
│   ├── app.js          # Configuración de Express
│   └── server.js       # Punto de entrada del servidor
├── tests/              # Pruebas unitarias y de integración
├── .env.example        # Plantilla de variables de entorno
└── .gitignore          # Archivo para excluir archivos sensibles (.env)

```

## 🐳 Levantar con Docker y Docker Compose

El proyecto está configurado para ejecutarse fácilmente en contenedores usando Docker y Docker Compose, lo que levanta tanto la API como la base de datos PostgreSQL de forma automatizada y sincronizada.

### Requisitos previos

Asegúrate de tener instalados:
- **Docker**
- **Docker Compose**

### Instrucciones para iniciar el entorno

1. **Crear archivo de variables de entorno**:
   ```bash
   cp .env.example .env
   ```
   *(La configuración por defecto apunta al servicio de base de datos dentro de Docker).*

2. **Levantar los servicios**:
   ```bash
   docker-compose up --build
   ```
   *Este comando construirá la imagen del backend e iniciará los servicios de base de datos (`db`) y de API (`api`).*

3. **Verificar el estado**:
    - La API estará accesible en: `http://localhost:3000`
    - El endpoint de salud en: `http://localhost:3000/health`
    - El dashboard de monitoreo en: `http://localhost:3000/health/dashboard`

### Detener los servicios

Para detener y limpiar los contenedores, ejecuta:
```bash
docker-compose down
```
Para borrar también los datos persistidos de la base de datos, puedes añadir la bandera `-v`:
```bash
docker-compose down -v
```

---

## 📋 Endpoints de la API

### Autenticación (`/api/v1/auth`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/auth/register` | No | Registrar nuevo usuario |
| `POST` | `/auth/login` | No | Iniciar sesión |
| `POST` | `/auth/verify-otp` | No | Verificar código OTP (2FA) |
| `POST` | `/auth/refresh-token` | No | Renovar access token |
| `POST` | `/auth/forgot-password` | No | Solicitar recuperación de contraseña |
| `POST` | `/auth/verify-reset-code` | No | Verificar código de recuperación |
| `POST` | `/auth/reset-password` | No | Restablecer contraseña |

### Usuarios (`/api/v1/users`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/users/:id` | No | Perfil público del usuario |
| `GET` | `/users/me` | JWT | Perfil privado del usuario autenticado |
| `PATCH` | `/users/:id` | JWT | Actualizar perfil (solo propio usuario) |
| `POST` | `/users/:id/change-password` | JWT | Cambiar contraseña validando contraseña actual (complejidad requerida) |
| `POST` | `/users/:id/change-email` | JWT | Iniciar cambio de correo. Envía OTP a email actual y nuevo |
| `POST` | `/users/:id/verify-email-change` | JWT | Verificar OTPs y confirmar cambio de email |
| `POST` | `/users/:id/change-phone` | JWT | Iniciar cambio de teléfono. Envía OTP a teléfono actual y nuevo |
| `POST` | `/users/:id/verify-phone-change` | JWT | Verificar OTPs y confirmar cambio de teléfono |

### Perfil de Cliente (`/api/v1/users`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/users/:id/client-profile` | JWT | Obtener perfil de cliente |
| `POST` | `/users/:id/client-profile` | JWT | Crear perfil de cliente |
| `PATCH` | `/users/:id/client-profile` | JWT | Actualizar perfil de cliente |

### Ubicaciones (`/api/v1/locations`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/users/:id/locations` | JWT | Crear ubicación (address, latitude, longitude) |
| `GET` | `/users/:id/locations` | JWT | Listar ubicaciones del usuario (`?lat=&lng=` para distancia) |
| `GET` | `/locations/:location_id` | JWT | Detalles de una ubicación |
| `PATCH` | `/locations/:location_id` | JWT | Actualizar dirección, coordenadas o marcado como principal |
| `DELETE` | `/locations/:location_id` | JWT | Eliminar ubicación |

### Métodos de Pago (`/api/v1/users/:id/payment-methods` y `/api/v1/payment-methods`)

Gestión y ciclo de vida de los métodos de pago (tarjetas) de los usuarios.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/users/:id/payment-methods` | JWT | Registrar un nuevo método de pago (tarjeta de crédito/débito). Valida Luhn, enmascara el PAN y encripta con AES-256 |
| `GET` | `/users/:id/payment-methods` | JWT | Listar los métodos de pago guardados del usuario (números enmascarados) |
| `PATCH` | `/payment-methods/:id` | JWT | Actualizar expiración, titular o estado predeterminado de un método de pago |
| `DELETE` | `/payment-methods/:id` | JWT | Eliminar un método de pago (valida que no existan transacciones pendientes) |

**Reglas y validaciones:**
- `card_number`: Validador Luhn obligatorio, longitud de 13 a 19 dígitos.
- `cvv`: Obligatorio, longitud de 3 a 4 dígitos. No se almacena en la base de datos (cumplimiento PCI-DSS).
- `is_primary`: Flag para marcar la tarjeta predeterminada del usuario. Si es la primera tarjeta o se establece explícitamente en `true`, se desmarca automáticamente el resto.
- Límite: Máximo de 10 métodos de pago por usuario.
- Encriptación: Se almacena solo los últimos 4 dígitos visibles y el resto se encripta de forma segura usando AES-256-CBC con la clave `ENCRYPTION_KEY`.
- Eliminación: No se permite eliminar una tarjeta si está asociada a transacciones en estado `PENDING` o `ESCROWED`.

### Procesamiento de Pagos e Integración con Stripe (`/api/v1/payments` y `/api/v1/webhooks`)

Flujo de procesamiento de transacciones reales integrado con Stripe (Payment Intents y confirmación asíncrona mediante Webhooks).

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/payments/process` | JWT | Iniciar proceso de pago para una orden (`order_id`, `payment_method_id`, `amount`). Crea un Payment Intent en Stripe y devuelve éxito (`succeeded`) o requerimiento de autenticación 3D Secure (`requires_action`) |
| `POST` | `/webhooks/payment` | No | Recibe y procesa los webhooks enviados por Stripe (`payment_intent.succeeded` o `payment_intent.payment_failed`). Valida la autenticidad con `stripe-signature` y actualiza la transacción local a `ESCROWED` o `FAILED` |

**Detalles de resiliencia y seguridad:**
- **Reintentos automáticos**: Las llamadas al API de Stripe se reintentan hasta un máximo de 3 veces con backoff exponencial ante errores transitorios de red o de API.
- **Validación de firmas**: Las solicitudes al webhook verifican obligatoriamente la firma `stripe-signature` para prevenir usurpaciones.
- **Flujo 3D Secure**: Soporte completo para flujos que requieren interacción del cliente, actualizando el estado de forma asíncrona mediante el webhook.

### Certificaciones de Trabajadores (`/api/v1/workers/:id/certifications` y `/api/v1/certifications`)

Gestión y validación de documentos oficiales presentados por los proveedores para habilitar sus perfiles.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/workers/:id/certifications` | JWT | Subir un nuevo documento de certificación (`BACKGROUND_CHECK`, `ID_VERIFICATION`, o `PROFESSIONAL_LICENSE`). Admite PDF/imagen hasta 10MB |
| `GET` | `/workers/:id/certifications` | JWT | Listar todas las certificaciones subidas por el proveedor asociado |
| `GET` | `/certifications/:id` | JWT | Detalles de una certificación específica (solo accesible por el propio proveedor o admin) |
| `PATCH` | `/certifications/:id` | JWT | Reenviar archivo para una certificación previamente rechazada, restableciendo su estado a `PENDING` |
| `PATCH` | `/certifications/:id/status` | JWT | Actualizar estado de verificación (`APPROVED` o `REJECTED`). Si es `REJECTED`, exige un `rejected_reason` |

**Reglas de negocio y estados:**
- **Estados de verificación**: `PENDING` (esperando revisión), `APPROVED` (aprobado), `REJECTED` (rechazado).
- **Subida**: Límite de tamaño estricto de 10MB. Tipos de archivo permitidos: `.pdf`, `.png`, `.jpg`, `.jpeg`.
- **Integridad de perfil**: Si todas las certificaciones asociadas a un proveedor son aprobadas (`APPROVED`), el estado de certificación del perfil del trabajador se actualiza automáticamente a `APPROVED` (permitiéndole alternar al rol de trabajador). Si alguna es rechazada, el perfil pasa a `REJECTED`.
- **Auditoría**: Cada cambio de estado genera un log de auditoría detallado y envía una notificación simulada por correo/push al trabajador.

### Búsqueda de Trabajadores (`/api/v1/workers`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/workers/nearby` | JWT | Trabajadores disponibles en un radio (`latitude`, `longitude`, `radius_km`, `category_id?`, `limit?`, `offset?`) |

### Disponibilidad del Trabajador (`/api/v1/workers/:id/availability` y `/api/v1/availability`)

Configuración de la disponibilidad horaria semanal de los trabajadores (día de la semana + rangos de horas en los que pueden recibir solicitudes).

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/workers/:id/availability` | JWT | Crear un rango de disponibilidad (`day_of_week` 0-6, `start_time`, `end_time`). Máximo 2 rangos por día |
| `GET` | `/workers/:id/availability` | JWT | Listar la disponibilidad del trabajador (solo propio). Ordenada por día y hora de inicio |
| `PATCH` | `/availability/:id` | JWT | Actualizar el día u horario de un rango de disponibilidad |
| `DELETE` | `/availability/:id` | JWT | Eliminar un rango de disponibilidad |

**Reglas de negocio y validaciones:**

- **`day_of_week`**: número entero entre `0` (Domingo) y `6` (Sábado).
- **Horarios**: formato `HH:mm` (24 horas). `start_time` siempre debe ser anterior a `end_time`.
- **Límite**: máximo **2 rangos por día** por trabajador (al crear o al mover un rango a otro día).
- **Permisos**: solo el propietario del perfil de trabajador (`worker_profiles.user_id === usuario autenticado`) puede crear, listar, actualizar o eliminar sus rangos.
- Restricciones a nivel de BD (migración `20260818020000_create_worker_availability.js`): `CHECK (day_of_week BETWEEN 0 AND 6)` y `CHECK (start_time < end_time)`, con índices en `worker_id` y `day_of_week`.

**Ejemplo — crear disponibilidad:**

```json
POST /api/v1/workers/:id/availability
Authorization: Bearer <accessToken>
{
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "13:00"
}
```

Respuesta `201 Created`:

```json
{
  "message": "Disponibilidad creada correctamente",
  "availability": {
    "id": "a1b2c3d4-...",
    "worker_id": "c3d4e5f6-...",
    "day_of_week": 1,
    "start_time": "09:00",
    "end_time": "13:00",
    "created_at": "2026-08-18T12:00:00.000Z",
    "updated_at": "2026-08-18T12:00:00.000Z"
  }
}
```

### Chats (`/api/v1/chats`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/chats` | JWT | Crear chat con otro usuario (`user_id_2`, `order_id?`). Idempotente: devuelve el chat existente (`200`, `created: false`) |
| `GET` | `/users/:id/chats` | JWT | Listar chats del usuario (solo propio). Filtros: `status` (`all`, `favorites`, `active`, `archived`), `search` (por nombre del otro usuario). `?limit=&offset=` para paginación; incluye `unread_count`, último mensaje, `is_favorite` e `is_archived`. Orden: primero favoritos, luego por `last_message_at` |
| `GET` | `/chats/:chat_id` | JWT | Detalle del chat + últimos 50 mensajes. Marca los mensajes como leídos |
| `DELETE` | `/chats/:chat_id` | JWT | Eliminar chat (soft delete: lo oculta solo para el usuario) |

### Mensajería (`/api/v1/chats/:chat_id/messages` y `/api/v1/messages`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/chats/:chat_id/messages` | JWT | Enviar mensaje. `message_type`: `TEXT`, `IMAGE`, `QUOTE` (default `TEXT`). `content` obligatorio para `TEXT`/`QUOTE` (máx 5000). Para `IMAGE`, adjuntar `file` (multipart, JPG/PNG, máx 5MB); se redimensiona a 1600px y se comprime. Emite `message:new` por WS |
| `GET` | `/chats/:chat_id/messages` | JWT | Listar mensajes (`?limit=&offset=`; default 50, máx 100, más recientes al final). Marca la conversación como leída |
| `DELETE` | `/messages/:message_id` | JWT | Eliminar mensaje (solo el autor, soft delete). Emite `message:deleted` por WS |

### Cotizaciones (`/api/v1/orders/:order_id/quotes` y `/api/v1/quotes`)

Gestión de cotizaciones (propuestas de tarifa y agenda) que el trabajador envía sobre una orden.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/orders/:order_id/quotes` | JWT (worker) | Crear cotización (`proposed_price`, `proposed_date`, `proposed_time`). Solo el trabajador de la orden y si la orden está activa. Crea la quote en `PENDING` |
| `GET` | `/orders/:order_id/quotes` | JWT | Listar cotizaciones de la orden en orden cronológico (solo cliente o trabajador de la orden) |
| `GET` | `/quotes/:quote_id` | JWT | Detalle de una cotización (solo participantes de la orden) |
| `PATCH` | `/quotes/:quote_id` | JWT | Cambiar estado: `ACCEPTED`/`REJECTED` (solo cliente, con `rejection_reason` opcional) o `CANCELLED` (solo trabajador) |
| `DELETE` | `/quotes/:quote_id` | JWT | Eliminar cotización (solo trabajador y si está en `PENDING`) |

**Máquina de estados de cotizaciones:** `PENDING → ACCEPTED | REJECTED | CANCELLED` (solo se transiciona desde `PENDING`). Cualquier otra transición devuelve `409 INVALID_TRANSITION`.

**Reglas y validaciones:**

- `proposed_price`: número obligatorio, positivo, máx. `99,999,999.99` (2 decimales).
- `proposed_date`: obligatoria, formato ISO `YYYY-MM-DD`; debe ser hoy o una fecha futura.
- `proposed_time`: obligatoria, formato `HH:mm`.
- Solo el **trabajador asignado** a la orden puede crear cotizaciones y solo si la orden está `PENDING`, `ACCEPTED` o `IN_PROGRESS` (si no, `409 ORDER_NOT_ACTIVE`).
- Solo el **cliente** puede aceptar/rechazar (`PATCH`); solo el **trabajador** puede cancelar su propuesta (`CANCELLED`) o eliminar la cotización.
- El motivo de rechazo (`rejection_reason`, opcional, máx. 1000 caracteres) se guarda para permitir renegociación.
- Al **aceptar** una cotización se ejecuta de forma atómica: la cotización pasa a `ACCEPTED`, las demás cotizaciones pendientes de la orden pasan a `REJECTED`, la orden pasa a `ACCEPTED` y se **inicia el escrow**: se carga la tarjeta primaria del cliente y la transacción nace en `ESCROWED` (fondos retenidos). Si el cargo falla, la transacción pasa a `FAILED` y la orden se **cancela automáticamente** (`402 PAYMENT_FAILED`). Un índice `UNIQUE (order_id)` en `transactions` garantiza un solo pago por orden (`409 PAYMENT_ALREADY_STARTED`).

**Ejemplo — crear cotización:**

```json
POST /api/v1/orders/:order_id/quotes
Authorization: Bearer <accessToken>
{
  "proposed_price": 35000,
  "proposed_date": "2026-08-20",
  "proposed_time": "14:30"
}
```

Respuesta `201 Created`:

```json
{
  "message": "Cotización creada correctamente",
  "quote": {
    "id": "a1b2c3d4-...",
    "order_id": "c3d4e5f6-...",
    "proposed_price": 35000,
    "proposed_date": "2026-08-20",
    "proposed_time": "14:30:00",
    "status": "PENDING",
    "rejection_reason": null,
    "created_at": "2026-08-13T12:00:00.000Z",
    "updated_at": "2026-08-13T12:00:00.000Z"
  }
}
```

**Ejemplo — rechazar con motivo (renegociación):**

```json
PATCH /api/v1/quotes/:quote_id
Authorization: Bearer <accessToken>
{
  "status": "REJECTED",
  "rejection_reason": "El precio supera mi presupuesto"
}
```

**Ejemplo — aceptar (inicia el pago):**

```json
{ "status": "ACCEPTED" }
```

**Cambios de base de datos (migración `20260811000000_add_quote_rejection_reason.js`):**

- Columna `rejection_reason` (`TEXT`, nullable) en `quotes`.
- Constraint `quotes_status_check` que restringe `status` a `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`.
- Índice `UNIQUE (order_id)` en `transactions` para garantizar una sola transacción (pago/escrow) por orden.

### Sistema de Escrow (`docs/ESCROW_SYSTEM.md`)

Retención, liberación y reembolso de fondos sobre las transacciones:

- **Estados de transacción**: `PENDING`, `ESCROWED`, `COMPLETED`, `REFUNDED`, `FAILED` (constraint `transactions_status_check`).
- **Al aceptar cotización**: cargo simulado a la tarjeta del cliente → transacción `ESCROWED` y monto retenido en `user_wallets.escrowed_balance`. Si el cargo falla → `FAILED` y la orden se cancela (`402 PAYMENT_FAILED`).
- **Al completar orden**: `releaseFunds` debita `escrowed_balance` del cliente y acredita `current_balance` del trabajador; transacción → `COMPLETED`.
- **Al cancelar orden** (desde `ACCEPTED`/`IN_PROGRESS`): `refund` reembolsa a la tarjeta; transacción → `REFUNDED`.
- **Auditoría**: `transaction_logs` registra cada cambio de estado (`from_status`, `to_status`, `changed_by_id`, `reason`).
- **Tablas nuevas**: `user_wallets` (saldo disponible y retenido) y `transaction_logs`.
- **Simulación**: el proveedor de pagos es simulado. `SIMULATE_CHARGE_FAILURE=true` en `.env` fuerza el fallo del cargo para probar la cancelación automática.

**Cambios de base de datos (migración `20260815000000_create_escrow_system.js`):**
- Constraint `transactions_status_check` (incluye `FAILED`).
- Tabla `user_wallets` (`user_id` UNIQUE, `current_balance`, `escrowed_balance`).
- Tabla `transaction_logs` (auditoría de estados).

### Órdenes (`/api/v1/orders`)

Gestión y ciclo de vida de las órdenes (pedidos de servicio) mediante una máquina de estados.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/orders/:id` | JWT | Detalles de una orden |
| `PATCH` | `/orders/:id/status` | JWT | Actualizar estado de la orden (sigue reglas de la máquina de estados) |
| `GET` | `/orders/:id/history` | JWT | Historial de auditoría de la orden (cambios de estado) |
| `POST` | `/orders/:id/complete` | JWT | Confirmar finalización del servicio (doble confirmación cliente/trabajador) |

**Máquina de estados de órdenes:** `PENDING → ACCEPTED | REJECTED`, `ACCEPTED → IN_PROGRESS | CANCELLED`, `IN_PROGRESS → COMPLETED | CANCELLED`.

**Reglas y validaciones:**
- `PENDING -> ACCEPTED` y `PENDING -> REJECTED` solo pueden ser solicitados por el **cliente**.
- `ACCEPTED -> IN_PROGRESS` y `IN_PROGRESS -> COMPLETED` solo pueden ser solicitados por el **trabajador**.
- `CANCELLED` en estado `ACCEPTED` o `IN_PROGRESS` puede ser solicitado por cualquiera de los dos (**cliente o trabajador**).
- Cada transición exitosa inserta un registro en la tabla `order_events` y emite el evento en tiempo real `order:status_changed` a los participantes vía WebSocket.
- Las transiciones a `COMPLETED` y `CANCELLED` disparan la lógica de escrow: `COMPLETED` libera los fondos retenidos al trabajador (`releaseFunds`), y `CANCELLED` reembolsa a la tarjeta del cliente y marca la transacción como `REFUNDED` (ver `docs/ESCROW_SYSTEM.md`).

**Confirmación de finalización (doble confirmación):**
- Endpoint `POST /orders/:id/complete` permite a cliente o trabajador confirmar/revocar la finalización del servicio.
- **Cliente (obligatorio)**: debe confirmar para que la orden pueda completarse.
- **Trabajador (opcional)**: puede confirmar, pero no bloquea la finalización.
- Cuando **ambas partes confirman** y la orden está en `IN_PROGRESS`, transiciona a `COMPLETED` y libera el escrow.
- Body opcional: `{ "confirm": true }` (default) para confirmar, `{ "confirm": false }` para revocar.
- Emite evento WebSocket `order:completion_confirmed` con `{ order_id, client_confirmed, worker_confirmed, status }`.

**Cambios de base de datos (migración `20260813122916_create_order_events.js`):**
- Nueva tabla `order_events` (`id`, `order_id`, `user_id`, `from_state`, `to_state`, `created_at`).
- Constraint `orders_status_check` que restringe los estados permitidos a `PENDING`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `REJECTED`, `CANCELLED`.

**Cambios de base de datos (migración `20260815000001_add_confirmations_to_orders.js`):**
- Columnas de confirmación dual en `orders`: `client_confirmed`, `worker_confirmed`, `client_confirmed_by`, `worker_confirmed_by`, `client_confirmed_at`, `worker_confirmed_at`.

### Disputas (`/api/v1/disputes`)

Gestión de disputas para resolver conflictos de calidad de servicio, cancelación o retenciones en órdenes de trabajo.

| Método | Ruta | Auth | Rol Mínimo | Descripción |
|--------|------|------|------------|-------------|
| `POST` | `/disputes` | JWT | Cliente o Trabajador | Abre una disputa para una orden en estado `COMPLETED` o `CANCELLED` |
| `GET` | `/disputes` | JWT | Cualquiera | Lista las disputas (usuarios ven las suyas; admins ven todas) |
| `PATCH` | `/disputes/:id` | JWT | Admin | Resuelve o cierra una disputa (`RESOLVED` o `CLOSED`) |

**Reglas de negocio y flujos:**
- **Apertura**: Solo los participantes directos (cliente o trabajador) de una orden en estado `COMPLETED` o `CANCELLED` pueden abrir una disputa. Máximo una disputa por orden.
- **Visualización**: Los usuarios normales están restringidos a ver únicamente las disputas donde participan activamente.
- **Resolución a favor del Cliente**:
  - Si los fondos están en **escrow** (`ESCROWED`): se devuelven al cliente y se cambia la transacción a `REFUNDED`.
  - Si el pago ya fue **completado** (`COMPLETED`): se debita el dinero del saldo disponible del trabajador (`current_balance`) y se procesa el reembolso al cliente.
- **Resolución a favor del Trabajador**:
  - Si los fondos están en **escrow** (`ESCROWED`): se liberan inmediatamente acreditándolos a la wallet del trabajador (`current_balance`).
  - Si el pago ya estaba **completado** (`COMPLETED`): no-op (mantiene el pago).
- Cada cambio emite eventos WebSocket (`dispute:created` y `dispute:status_changed`) y se registra en Winston.

### WebSocket (real-time messaging)

El servidor expone un WebSocket en `ws://<host>/ws`. El cliente se conecta pasando el
access token en el query string del handshake:

```
ws://<host>/ws?token=<accessToken>
```

Eventos que el servidor envía al cliente:

| Evento | Payload | Cuándo ocurre |
|--------|---------|---------------|
| `connected` | `{ user_id }` | Al autenticarse la conexión |
| `message:new` | `{ chat_id, message }` | Cuando hay un nuevo mensaje en un chat del usuario |
| `message:deleted` | `{ chat_id, message_id }` | Cuando un mensaje del chat es eliminado por su autor |
| `user:typing` | `{ chat_id, user_id, is_typing }` | Cuando otro participante del chat escribe |

Evento que el cliente envía al servidor:

| Tipo | Payload | Cuándo ocurre |
|------|---------|---------------|
| `user:typing` | `{ chat_id, is_typing }` | Para notificar que el usuario está escribiendo (el servidor lo reenvía a los demás participantes) |

Adjuntos: las imágenes de mensajes se guardan en `<UPLOAD_DIR>/messages/` (default `uploads/`,
ver `.env.example`) y se sirven desde `GET /uploads/...`.

### Salud y Documentación

| `GET` | `/health` | No | Health check básico del servicio (API, BD, Caché) |
| `GET` | `/health/detailed` | No | Health check detallado + métricas del APM interno |
| `GET` | `/health/dashboard` | No | Vista web del Dashboard de Monitoreo en tiempo real |
| `GET` | `/api/v1/health` | No | Health check heredado v1 |
| `GET` | `/api/v1/api-docs` | No | Documentación Swagger UI |

---

## 🛡️ Seguridad y Protección DDoS

El backend tiene implementadas políticas y defensas estrictas a nivel de infraestructura y de código para garantizar la integridad y seguridad del servicio:

### 1. Rate Limiting (Limitador de Tasa)
- **Global**: Límite de **1000 solicitudes/minuto por IP** para mitigar ataques de denegación de servicio (DDoS) o de raspado de datos.
- **Autenticación**: Límite específico de **5 intentos fallidos cada 15 minutos** por dirección IP. Los accesos correctos resetean este contador.
- **Órdenes de Trabajo**: Límite estricto de **20 creaciones de órdenes por hora por usuario** (`user_id`), evitando spamming o abusos transaccionales.

### 2. Sanitización contra XSS (Cross-Site Scripting)
- Middleware global recursivo (`sanitizeMiddleware`) que limpia etiquetas HTML/scripts en todos los parámetros entrantes (`req.body`, `req.query`, `req.params`).

### 3. Headers de Seguridad (Helmet.js)
- Configuración automática de cabeceras seguras en las respuestas HTTP (`X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, etc.) para proteger contra clickjacking y ataques relacionados con el navegador.

### 4. Protección contra SQL Injection
- Todas las consultas a la base de datos se realizan a través del constructor de consultas **Knex.js**, el cual utiliza de forma nativa parámetros y sentencias preparadas (Prepared Statements).

### 5. CORS Enforzado
- Intercepción estricta en base al dominio autorizado especificado en la variable `ALLOWED_ORIGINS` del entorno.

---

## 🚀 Pipeline de CI/CD (GitHub Actions)

El proyecto cuenta con integración y despliegue continuo automatizados mediante GitHub Actions.

### 🧪 Integración Continua (CI)
Se ejecuta de forma automática en cada **Pull Request** apuntando a cualquier rama o en pushes a ramas de desarrollo. Realiza las siguientes tareas:
1. Valida el formato de código con Prettier (`npm run format:check`).
2. Corre las pruebas unitarias y de integración del proyecto (`npm test`).

### 📦 Despliegue Continuo (CD)
Se ejecuta en cada **Push** o Merge directo a la rama `main`. Realiza las siguientes tareas:
1. Construye la imagen Docker de producción.
2. Sube la imagen Docker etiquetada a **Oracle Cloud Infrastructure Registry (OCIR)**.

### 🔒 Secretos requeridos en GitHub
Para que el workflow de CD funcione correctamente, debes configurar los siguientes secretos en tu repositorio de GitHub (`Settings > Secrets and variables > Actions`):

| Secreto | Descripción | Ejemplo / Formato |
|---------|-------------|-------------------|
| `OCI_REGISTRY` | Endpoint del registro de contenedores de Oracle Cloud | `<region-code>.ocir.io` |
| `OCI_USERNAME` | Nombre de usuario de acceso a OCI (incluye namespace) | `<tenancy-namespace>/oracleidentitycloudservice/<email>` |
| `OCI_AUTH_TOKEN` | Token de autenticación generado en la consola de OCI | `T[a1_exampleToken}` |
| `OCI_TENANCY_NAMESPACE` | Namespace de tu Tenancy en OCI | `id3abcde1234` |
| `OCI_REPO_NAME` | Nombre del repositorio de imágenes en OCIR | `backend-service` |