# Feature: Sistema de Calificaciones (Ratings)

## Resumen

Implementación completa del sistema de calificaciones para la plataforma work-on-demand. Permite a clientes y trabajadores calificar órdenes completadas, con cálculo automático del promedio, prevención de duplicados y documentación Swagger.

---

## Archivos Creados

| Archivo | Descripción |
|---|---|
| `src/database/migrations/20260818000000_add_rating_constraints_and_average.js` | Migración: constraints UNIQUE/CHECK y columna `average_rating` |
| `src/services/RatingService.js` | Lógica de negocio: crear, listar, promedio, recálculo |
| `src/controllers/RatingController.js` | Handler HTTP con respuestas estandarizadas |
| `src/routes/ratingRoutes.js` | Definición de rutas Express |
| `tests/rating.test.js` | 15 tests unitarios (servicio + controller) |

## Archivos Modificados

| Archivo | Cambio |
|---|---|
| `src/utils/validation.js` | Schemas Joi: `createRatingSchema`, `listRatingsQuerySchema` |
| `src/utils/swagger.js` | 7 schemas OpenAPI + documentación de 3 endpoints |
| `src/app.js` | Import y registro de `ratingRoutes` |

---

## Arquitectura

```
Request → ratingRoutes.js → RatingController.js → RatingService.js → DB (Knex)
```

### Capas

- **Routes** (`ratingRoutes.js`): Define las 3 rutas, aplica `authenticateToken` middleware.
- **Controller** (`RatingController.js`): Validación Joi, mapeo de errores del servicio a HTTP codes, respuestas estandarizadas `{ error, message, statusCode, timestamp }`.
- **Service** (`RatingService.js`): Toda la lógica de negocio, queries Knex, validaciones de dominio.

---

## Endpoints

### 1. `POST /api/v1/ratings`

**Crear calificación para una orden completada.**

Request body:
```json
{
  "order_id": "uuid-de-la-orden",
  "rating_stars": 5,
  "review_text": "Excelente trabajo (opcional, máx 1000 chars)"
}
```

Response 201:
```json
{
  "message": "Calificación creada correctamente",
  "rating": {
    "id": "uuid",
    "order_id": "uuid",
    "rater_id": "uuid-del-calificador",
    "ratee_id": "uuid-del-calificado",
    "rating_stars": 5,
    "review_text": "Excelente trabajo",
    "created_at": "2026-08-18T00:00:00.000Z"
  }
}
```

**Validaciones de negocio:**
1. La orden debe existir → 404 `ORDER_NOT_FOUND`
2. La orden debe estar en estado `COMPLETED` → 409 `ORDER_NOT_COMPLETED`
3. El usuario autenticado debe ser cliente O trabajador de la orden → 403 `FORBIDDEN`
4. No debe existir un rating previo del mismo usuario para la misma orden → 409 `ALREADY_RATED`
5. El `ratee_id` se determina automáticamente: si el rater es el cliente, el ratee es el trabajador, y viceversa (no se acepta del body)
6. Rating validation: `rating_stars` entre 1 y 5 (integer), `order_id` UUID válido

**Side effects:**
- Después del INSERT, se ejecuta `recalculateAverageRating()` que recalcula el promedio del ratee y lo persiste en `worker_profiles.average_rating` y/o `client_profiles.average_rating`.
- Se registra evento de auditoría en Winston logger.

---

### 2. `GET /api/v1/users/:id/ratings`

**Listar calificaciones recibidas por un usuario (donde es el calificado).**

Query params:
| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `limit` | integer | 20 | Máx 100, mín 1 |
| `offset` | integer | 0 | Para paginación |

Response 200:
```json
{
  "ratings": [
    {
      "id": "uuid",
      "order_id": "uuid",
      "rater_id": "uuid",
      "ratee_id": "uuid",
      "rating_stars": 5,
      "review_text": "Excelente",
      "created_at": "2026-08-18T00:00:00.000Z",
      "rater": {
        "user_id": "uuid",
        "full_name": "Juan Pérez",
        "avatar_url": "https://..."
      }
    }
  ],
  "count": 10,
  "limit": 20,
  "offset": 0
}
```

Incluye JOIN con `users` para traer nombre y avatar del calificador.

---

### 3. `GET /api/v1/users/:id/rating-average`

**Obtener el promedio de calificaciones de un usuario.**

Response 200:
```json
{
  "average_rating": 4.5,
  "total_ratings": 10
}
```

- `average_rating`: promedio redondeado a 1 decimal, o `null` si no tiene ratings.
- `total_ratings`: cantidad total de ratings recibidos.

---

## Base de Datos

### Tabla `ratings` (preexistente + migración)

Columnas originales (de migration `20260723000000`):
```
id            UUID PK
order_id      UUID → orders(id)
rater_id      UUID → users(id)         -- quién califica
ratee_id      UUID → users(id)         -- quién es calificado
rating_stars  INTEGER                  -- 1-5
review_text   TEXT                     -- nullable
created_at    TIMESTAMP
```

Constraints agregados (migration `20260818000000`):
```sql
-- Un solo rating por usuario por orden
ALTER TABLE ratings ADD CONSTRAINT ratings_order_rater_unique
  UNIQUE (order_id, rater_id);

-- Rating entre 1 y 5
ALTER TABLE ratings ADD CONSTRAINT ratings_stars_check
  CHECK (rating_stars >= 1 AND rating_stars <= 5);
```

### Columnas `average_rating` agregadas

```sql
ALTER TABLE worker_profiles ADD COLUMN average_rating DECIMAL(3,1);
ALTER TABLE client_profiles ADD COLUMN average_rating DECIMAL(3,1);
```

Se actualizan automáticamente cada vez que se crea un nuevo rating vía `recalculateAverageRating()`.

---

## Validación Joi

### `createRatingSchema`

| Campo | Tipo | Reglas |
|---|---|---|
| `order_id` | string | UUID válido, requerido |
| `rating_stars` | number | integer, min 1, max 5, requerido |
| `review_text` | string | trim, max 1000, permite empty/null |

### `listRatingsQuerySchema`

| Campo | Tipo | Reglas |
|---|---|---|
| `limit` | number | integer, min 1, max 100, default 20 |
| `offset` | number | integer, min 0, default 0 |

---

## Documentación Swagger/OpenAPI

Agregados en `src/utils/swagger.js`:

### Schemas de componentes
- `RatingResponse` — Rating individual
- `CreateRatingRequest` — Body para crear rating
- `CreateRatingResponse` — Respuesta al crear
- `RatingListItem` — Rating en listado (con nested `rater`)
- `ListRatingsResponse` — Listado paginado
- `RatingAverageResponse` — Respuesta de promedio
- `AlreadyRatedError` — Error duplicado
- `OrderNotCompletedError` — Error estado incorrecto

### Endpoints documentados
- `POST /ratings` — Crear calificación
- `GET /users/{id}/ratings` — Listar calificaciones recibidas
- `GET /users/{id}/rating-average` — Obtener promedio

Todos bajo tag `[Calificaciones]` con autenticación `bearerAuth`.

---

## Tests Unitarios (15 tests)

### RatingService (11 tests)

| Test | Escenario |
|---|---|
| ORDER_NOT_FOUND | Orden no existe → error 404 |
| ORDER_NOT_COMPLETED | Orden en estado PENDING → error 409 |
| FORBIDDEN | Usuario no es participante → error 403 |
| ALREADY_RATED | Usuario ya calificó esta orden → error 409 |
| Client rates worker | Crea rating correctamente, ratee = worker |
| Worker rates client | Crea rating correctamente, ratee = client |
| Average update | Verifica que se llama `update` en `worker_profiles` |
| List empty | Sin ratings → count=0, ratings=[] |
| List with data | Con ratings → incluye rater info (full_name) |
| Average no ratings | Sin ratings → average=null, total=0 |
| Average with data | Con ratings → average=4.5, total=10 |

### RatingController (4 tests)

| Test | Escenario |
|---|---|
| Validation error | Body vacío → 400 con VALIDATION_ERROR |
| Create success | Datos válidos → 201 con rating |
| List success | Retorna 200 con count=0, ratings=[] |
| Average success | Retorna 200 con average=4.0, total=5 |

### Ejecución

```bash
npm test
# Resultado: 339 passed, 3 failed (preexistentes: stripe module not installed)
```

---

## Decisiones de Diseño

1. **ratee_id auto-determinado**: No se acepta del body del request. Se infiere del orden (si el rater es el cliente, el ratee es el trabajador). Previene manipulación.

2. **Average denormalizado**: Se persiste en `worker_profiles.average_rating` y `client_profiles.average_rating` y se recalcula en cada INSERT. Mantiene datos consistentes sin queries adicionales en reads.

3. **Rutas bajo `/api/v1/ratings`**: Separado de `userRoutes` para evitar conflictos. Las rutas de usuario (`/users/:id/ratings`) están en el router de ratings, no en el de usuarios.

4. **Unique constraint a nivel DB + service**: El `UNIQUE(order_id, rater_id)` previene race conditions a nivel de base de datos, mientras que la validación en servicio brinda un error claro con mensaje descriptivo.

5. **Recálculo dual**: Al crear un rating, `recalculateAverageRating()` actualiza tanto `worker_profiles` como `client_profiles` (si existen), porque un usuario puede tener ambos perfiles.

---

## Cómo Ejecutar la Migración

```bash
npx knex migrate:latest
```

## Cómo Ejecutar los Tests

```bash
# Solo ratings
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/rating.test.js --no-coverage

# Todos
npm test
```
