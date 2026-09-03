# 🛠️ Guía de Desarrollo

Setup local, programación, debugging, testing y deployment del backend.

---

## ⚙️ Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | 18+ (las imágenes Docker usan Node 20) |
| npm | 9+ |
| Docker + Docker Compose | últimas |
| PostgreSQL | 14 + PostGIS 3.4 (via Docker) |
| Redis | 7 (opcional, tiene fallback en memoria) |

---

## 🚀 Setup local (Docker)

### 1. Clonar e instalar

```bash
git clone <repo> && cd backend
cp .env.example .env       # configurar variables (ver abajo)
npm install
```

### 2. Levantar infraestructura

```bash
docker compose up -d db redis
```

Esto inicia:
- **PostgreSQL + PostGIS** (`postgis/postgis:14-3.4-alpine`) en `localhost:5432`.
- **Redis 7** en `localhost:6379`.

### 3. Levantar la API

Opciones equivalentes:

```bash
# Opción A: contenedor de desarrollo con hot-reload
docker compose up -d api

# Opción B: en la máquina host con nodemon
npm run dev
```

> El contenedor `api` monta el código local (`.:/app`) y ejecuta `npm run dev`, por lo que los cambios se recargan automáticamente.

### 4. Migraciones y seeds

```bash
npm run migrate:latest    # aplicar migraciones
npm run seed:dev          # cargar datos demo (10 usuarios, 32 categorías, órdenes, escrow...)
npm run seed:clear        # limpiar BD (operación atómica)
```

### 5. Verificar

```bash
curl http://localhost:3000/api/v1/health     # health check
open http://localhost:3000/api-docs          # Swagger UI
```

---

## 📦 Variables de entorno (.env)

Las más relevantes (ver `.env.example` completo):

| Variable | Descripción |
|---|---|
| `PORT` / `NODE_ENV` | Puerto y entorno. |
| `ALLOWED_ORIGINS` | Orígenes CORS permitidos (coma-separados). |
| `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` | Conexión PostgreSQL. |
| `REDIS_URL` | Caché Redis (si falta → caché en memoria). |
| `JWT_SECRET` / `REFRESH_TOKEN_SECRET` | Secretos JWT (access y refresh). |
| `ENCRYPTION_KEY` | Clave AES-256-CBC para cifrar métodos de pago (32 bytes). |
| `SIMULATE_CHARGE_FAILURE` | `true` fuerza fallo del cargo en escrow (pruebas). |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Integración Stripe (opcional). |
| `FIREBASE_*` / `SENDGRID_*` / `TWILIO_*` | Proveedores de notificaciones (lazy-init). |
| `APM_LATENCY_THRESHOLD_MS` | Umbral de latencia para alertas. |

> **Nunca** se comitea `.env` (está en `.gitignore`). Solo se versiona `.env.example`.

---

## 🧪 Testing

```bash
npm test                    # suite completa + cobertura
npm test -- <archivo>       # test específico
```

- Framework: **Jest 29 + supertest**, con Babel para ESM (`--experimental-vm-modules`).
- Cobertura global: **70% statements/lines**, 55% branches, 60% functions.
- Cobertura reforzada en servicios críticos (Auth, Payment, Order, Chat, Escrow, validation).
- Reporte HTML en `coverage/`.

---

## 🎨 Formato y linting

El proyecto usa **Prettier** como formatter (no hay ESLint configurado).

```bash
npm run format:check   # verificar que el código está formateado (obligatorio antes de commit)
npm run format         # formatear automáticamente
```

Reglas: `.prettierrc` / `.prettierignore`. Aplica a `src/**/*.js` y `tests/**/*.js`.

---

## 🧑‍💻 Debugging

- **Hot-reload**: `npm run dev` (nodemon) recarga ante cambios.
- **Logs estructurados**: Winston (`src/utils/logger.js`) imprime JSON con niveles `ERROR/WARN/INFO/DEBUG` y contexto por petición (AsyncLocalStorage inyecta `userId`).
- **Dashboard de monitoreo**: `src/utils/dashboard.html` + endpoints de health/monitoring (`GET /health`, `GET /api/v1/health`).
- **APM**: el middleware registra latencia, distribución de códigos y alertas (5xx, latencia alta) en memoria.

### Flujo de depuración de un endpoint

1. Lee la **ruta** (`src/routes/*.js`) para conocer el middleware y el controller.
2. Revisa el **controller** → validación Joi y llamada al servicio.
3. Inspecciona el **service** → lógica y queries Knex.
4. Revisa logs del servidor; usa `logger.error/info/warn` donde haga falta.
5. Verifica contra Swagger (`/api-docs`) o `docs/openapi.yaml` el contrato.

---

## 🧩 Scripts útiles

| Script | Descripción |
|---|---|
| `npm run dev` / `npm start` | Dev (hot-reload) / producción. |
| `npm run migrate:latest` / `:rollback` / `:make` | Migraciones Knex. |
| `npm run seed` / `seed:dev` | Sembrar datos demo. |
| `npm run seed:clear` | Limpiar BD. |
| `npm run swagger:export` | Regenerar `docs/openapi.yaml`. |

---

## 🚢 Deployment

### Docker

`Dockerfile` multi-etapa:

| Etapa | Uso |
|---|---|
| `base` | Imagen Node 20, copia `package*.json`. |
| `development` | `npm install` + código completo, `CMD npm run dev`. |
| `production` | `npm ci --only=production` + `src/`, `CMD npm start`. |

Construir imagen de producción:

```bash
docker build --target production -t ondemand-api .
```

### CI/CD (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`): en cada PR a `main` → `npm ci`, `npm run format:check`, `npm test`.
- **CD** (`.github/workflows/cd.yml`): en push a `main` → build de imagen `production` con Docker Buildx y **push a Oracle Cloud Infrastructure Registry (OCIR)**.
  - Secreta requeridos: `OCI_REGISTRY`, `OCI_USERNAME`, `OCI_AUTH_TOKEN`, `OCI_TENANCY_NAMESPACE`, `OCI_REPO_NAME`.
  - Etiquetas: `latest` + `${{ github.sha }}`; cache `type=gha` para builds más rápidos.

### Producción (PostgreSQL)

- La config de producción (`knexfile.js`) exige variables de BD y soporta `DB_SSL=true`.
- Migraciones en producción: `NODE_ENV=production npm run migrate:latest`.

---

## 🧪 Flujo de verificación recomendado (DoD)

```bash
npm run format:check   # 1. formato
npm test               # 2. tests + cobertura ≥70%
npm run migrate:latest # 3. migraciones correctas
npm run seed:dev       # 4. seeds
npm run dev            # 5. app levantada
```

> Detalle de convenciones y arquitectura en [CODE_STANDARDS.md](./CODE_STANDARDS.md) y [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 🔗 Documentos relacionados

- [README.md](./README.md) — índice general.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — componentes y flujos.
- [CODE_STANDARDS.md](./CODE_STANDARDS.md) — estilo y estructura de carpetas.
