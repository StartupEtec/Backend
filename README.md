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
- `npm test`: Ejecuta la suite de pruebas unitarias usando `Jest`.

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
   - El endpoint de salud estará disponible en: `http://localhost:3000/api/v1/health`

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

### Búsqueda de Trabajadores (`/api/v1/workers`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/workers/nearby` | JWT | Trabajadores disponibles en un radio (`latitude`, `longitude`, `radius_km`, `category_id?`, `limit?`, `offset?`) |

### Chats (`/api/v1/chats`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/chats` | JWT | Crear chat con otro usuario (`user_id_2`, `order_id?`). Idempotente: devuelve el chat existente (`200`, `created: false`) |
| `GET` | `/users/:id/chats` | JWT | Listar chats del usuario (solo propio). `?limit=&offset=` para paginación; incluye `unread_count` y último mensaje |
| `GET` | `/chats/:chat_id` | JWT | Detalle del chat + últimos 50 mensajes. Marca los mensajes como leídos |
| `DELETE` | `/chats/:chat_id` | JWT | Eliminar chat (soft delete: lo oculta solo para el usuario) |

### Mensajería (`/api/v1/chats/:chat_id/messages` y `/api/v1/messages`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/chats/:chat_id/messages` | JWT | Enviar mensaje. `message_type`: `TEXT`, `IMAGE`, `QUOTE` (default `TEXT`). `content` obligatorio para `TEXT`/`QUOTE` (máx 5000). Para `IMAGE`, adjuntar `file` (multipart, JPG/PNG, máx 5MB); se redimensiona a 1600px y se comprime. Emite `message:new` por WS |
| `GET` | `/chats/:chat_id/messages` | JWT | Listar mensajes (`?limit=&offset=`; default 50, máx 100, más recientes al final). Marca la conversación como leída |
| `DELETE` | `/messages/:message_id` | JWT | Eliminar mensaje (solo el autor, soft delete). Emite `message:deleted` por WS |

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

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/v1/health` | No | Health check del servicio |
| `GET` | `/api/v1/api-docs` | No | Documentación Swagger UI |

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