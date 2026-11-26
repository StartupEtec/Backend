# 📏 Code Standards

Guía de estilo, estructura de carpetas y convenciones de código del backend.

---

## 🗂️ Estructura de carpetas

```
src/
├── app.js                # Configuración de Express (middleware stack, rutas, errores)
├── server.js             # Punto de entrada (HTTP + WebSocket + cache + graceful shutdown)
├── controllers/          # Capa HTTP: validación Joi, mapeo request/response
├── services/             # Lógica de negocio, transacciones, integraciones
├── routes/               # Definición de endpoints (Express Router)
├── middlewares/          # auth, rateLimit, sanitize, apm, upload
├── utils/                # cache, logger, validation, swagger, websocket, encryption
├── services/providers/   # Envoltorios de servicios externos (notificaciones)
└── database/
    ├── db.js             # Conexión Knex
    ├── migrations/       # Migraciones versionadas (YYYYMMDDHHMMSS_*.js)
    └── seeds/            # Datos de ejemplo

tests/                    # Tests unitarios e integración (Jest + supertest)
docs/                     # Documentación del proyecto
```

---

## 🧭 Arquitectura en capas (obligatoria)

```
routes → controllers → services → database (Knex)
```

- **Lógica de negocio** va en los servicios, **nunca** en los controllers.
- **Acceso a datos** se hace mediante Knex dentro de los servicios (no hay capa de "models" separada; el proyecto usa `knex` directamente).
- Los controllers **solo** gestionan HTTP: validan entrada, llaman al servicio y formatean la respuesta/error.
- Los servicios son **singleton**: `export default new ChatService();` (ver `src/services/*`).

Regla de dependencia: una capa solo puede depender de las inferiores a ella.

---

## ✍️ Convenciones de naming

| Elemento | Convención | Ejemplo |
|---|---|---|
| Variables / funciones | `camelCase` | `getOrderById`, `availabilityStatus` |
| Clases | `PascalCase` | `class OrderService` |
| Constantes | `UPPER_SNAKE_CASE` | `DEFAULT_LIMIT`, `MAX_LIMIT` |
| Archivos de servicios | `PascalCase` + `Service.js` | `OrderService.js`, `EscrowService.js` |
| Archivos de controllers | `PascalCase` + `Controller.js` | `OrderController.js` |
| Archivos de rutas | `camelCase` + `Routes.js` | `orderRoutes.js` |
| Middlewares | `camelCase` exportados | `authenticateToken`, `requireRole` |
| Migraciones | `YYYYMMDDHHMMSS_<nombre>.js` | `20260815000000_create_escrow_system.js` |
| Tablas / columnas (BD) | `snake_case` | `user_wallets`, `transaction_logs` |
| Payloads JSON (API) | `snake_case` (coherente con BD) | `otp_code`, `current_role` |

> **Nombres descriptivos, no abreviaturas crípticas**: prefiere `getOrderById` sobre `getOb` o `g`.

---

## 🧱 Convenciones de componente/función

- **Una responsabilidad por función**; si una función crece, extrae helper.
- Las funciones de formato/mapeo de respuesta se aíslan (ver `ChatService.formatMessage`, `formatChat`, `formatChatListItem`).
- Constantes de configuración (límites, defaults) se definen al inicio del módulo (`DEFAULT_LIMIT`, `MAX_LIMIT`).
- Evita funciones con más de ~3 responsabilidades claras (mantener testables).

---

## 🧪 Manejo de errores consistente

- Respuestas con la estructura estándar (ver [API_DESIGN.md](./API_DESIGN.md)):

```json
{
  "error": "CÓDIGO_EN_SNAKE_CASE",
  "message": "mensaje legible",
  "statusCode": 400,
  "timestamp": "2026-06-30T12:00:00.000Z"
}
```

- En los controllers se usa el patrón:

```js
const { error, value } = schema.validate(req.body);
if (error) {
  return res.status(400).json({
    error: 'VALIDATION_ERROR',
    message: error.details[0].message,
    statusCode: 400,
    timestamp: new Date().toISOString(),
  });
}
```

- Los errores no controlados se pasan a `next(err)` para que los capture el **middleware central** de `src/app.js`.

---

## 💾 Transacciones atómicas

- **Toda operación multi-paso sobre dinero/estado crítico** debe ejecutarse en una transacción Knex.
- El servicio recibe la `trx` iniciada por el llamador y todas las escrituras comparten el mismo `COMMIT`/`ROLLBACK`.

```js
await db.transaction(async (trx) => {
  await trx('orders').where({ id }).update({ status: 'COMPLETED' });
  await escrowService.releaseFunds(trx); // usa la misma trx
  await trx('order_events').insert(...);
});
```

- Si algo falla, se lanza y la transacción se revierte (la orden **no** uede quedar en estado parcial).

---

## 🔒 Seguridad

- **Validación de entrada** con Joi (esquemas en `src/utils/validation.js`) en todos los endpoints con body/params.
- **Sanitización XSS** global (middleware `sanitize.js`) limpia `body/query/params`.
- **Auth/autorización**: `authenticateToken` + `requireRole([...])` en endpoints protegidos.
- **Rate limiting**: global + específicos (orden, auth) — `src/middlewares/rateLimiter.js`.
- **Sin secretos en el código**: todo configurable vía `.env` (`.env.example` documentado). **Nunca** comitear `.env`.
- **Nunca loguear**: tokens, contraseñas, PAN/CVV ni datos sensibles.
- **Cifrado de métodos de pago** con AES-256-CBC (`src/utils/encryption.js`).

---

## 📝 Comentarios y logging

- Comentarios **solo donde la lógica no es obvia**; documentar el *por qué*, no el *qué*.
- JSDoc en los métodos públicos clave de los servicios (ej. `AuthService`, `OtpService`).
- Logging estructurado con **Winston** (`src/utils/logger.js`) con niveles `ERROR/WARN/INFO/DEBUG`:
  - Log: transacciones de dinero, cambios de estado críticos y errores.
  - No loguear: datos sensibles.
- `[AUDITORIA]` se usa en operaciones de escritura relevantes.

---

## 🧾 Testing (mínimo)

- **Jest + supertest** con Babel para ESM.
- Umbral de cobertura global: **70%** statements/lines, 55% branches, 60% functions.
- Cobertura reforzada (70%) en archivos críticos: `AuthService`, `PaymentService`, `OrderService`, `ChatService`, `EscrowService`, `validation.js`.
- Tests en `tests/<modulo>.test.js` / `tests/<servicio>.test.js`.
- Ejecutar: `npm test`.

---

## 🎨 Formato (Prettier)

- Prettier configurado para `src/**/*.js` y `tests/**/*.js`.
- Verificar: `npm run format:check`.
- Formatear: `npm run format`.
- **Antes de commit**: el código debe pasar `format:check` (ya validado en CI).

---

## 🚀 Buenas prácticas resumidas

1. Respeta la arquitectura por capas y la inyección de servicios singleton.
2. Usa transacciones para operaciones multi-paso.
3. Valida la entrada (Joi) y sanitiza (global).
4. Usa nombres descriptivos y funciones con una sola responsabilidad.
5. Maneja errores con la estructura estándar y pasa los no controlados a `next(err)`.
6. Loguea con Winston sin datos sensibles.
7. Mantén cobertura de tests ≥70% en servicios clave.
8. Corre `npm run format:check` antes de commit.
9. Documenta cambios de API en Swagger (`npm run swagger:export`).

---

## 🔗 Documentos relacionados

- [ARCHITECTURE.md](./ARCHITECTURE.md) — capas y flujos.
- [API_DESIGN.md](./API_DESIGN.md) — convenciones de la API y errores.
- [DEVELOPMENT.md](./DEVELOPMENT.md) — setup y herramientas.
