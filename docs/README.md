# 📚 Documentación del Backend

Índice central de toda la documentación técnica del backend de la **plataforma digital on-demand** para conectar trabajadores independientes con clientes.

> **Stack**: Node.js 18+ / Express 4 · JavaScript (ESM) · PostgreSQL 14 + PostGIS 3.4 · Knex · Redis · WebSocket (`ws`) · Docker.

---

## 🧭 Índice de documentos

| Documento | Descripción |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitectura por capas, diagrama de componentes, flujos de datos y decisiones de diseño. |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Esquema de BD relacional (PostgreSQL + PostGIS), ER diagram, descripción de todas las tablas, índices y constraints. |
| [ORDER_STATE_MACHINE.md](./ORDER_STATE_MACHINE.md) | Máquina de estados de órdenes: estados, transiciones, actores, auditoría y doble confirmación. |
| [ESCROW_SYSTEM.md](./ESCROW_SYSTEM.md) | Sistema de retención/liberación/reembolso de fondos (escrow), modelo de datos y flujos atómicos. |
| [API_DESIGN.md](./API_DESIGN.md) | Convenciones de la API REST: naming, versionado, manejo de errores, paginación y autenticación. |
| [AUTHENTICATION.md](./AUTHENTICATION.md) | Flujos de autenticación: registro, login, JWT (access/refresh), OTP 2FA y recuperación de contraseña. |
| [CODE_STANDARDS.md](./CODE_STANDARDS.md) | Guía de estilo, estructura de carpetas, convenciones de naming y buenas prácticas de código. |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Setup local, debugging, testing, deployment y CI/CD. |

---

## 🗂️ Documentos de features / issues

Docs específicos por funcionalidad e issue de GitHub:

| Documento | Issue | Tema |
|---|---|---|
| [CHAT_IMPLEMENTATION.md](./CHAT_IMPLEMENTATION.md) | #4, #27 | Sistema de chat y mensajería en tiempo real (WebSocket). |
| [NOTIFICATION_SYSTEM.md](./NOTIFICATION_SYSTEM.md) | #58 | Sistema centralizado de notificaciones multicanal (Push/Email/SMS). |
| [MESSAGING_WS_IMPLEMENTATION.md](./MESSAGING_WS_IMPLEMENTATION.md) | #27 | Implementación de mensajería + WebSocket. |
| [ratings-feature.md](./ratings-feature.md) | — | Sistema de calificaciones. |

---

## 📄 Especificación OpenAPI

- **[openapi.yaml](./openapi.yaml)** — Especificación OpenAPI 3.0 exportada desde el código.
- Regenerar tras cambios de endpoints: `npm run swagger:export`.
- Visualizar en desarrollo: <http://localhost:3000/api-docs> (Swagger UI).

---

## 🚀 Inicio rápido

```bash
# 1. Clonar e instalar dependencias
cp .env.example .env
npm install

# 2. Levantar infraestructura (PostgreSQL + Redis) y aplicación
docker compose up -d          # solo infra
npm run dev                   # backend con hot-reload

# 3. Aplicar migraciones y sembrar datos demo
npm run migrate:latest
npm run seed:dev

# 4. Verificar
curl http://localhost:3000/api/v1/health
```

Consulta [DEVELOPMENT.md](./DEVELOPMENT.md) para la guía detallada.
