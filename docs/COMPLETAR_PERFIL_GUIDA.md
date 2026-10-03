# Guía de pruebas: Flujo Completar Perfil

Guía paso a paso para verificar el flujo de onboarding (fecha de nacimiento,
avatar, frente/dorso del DNI) desde el **frontend**.

Todos los valores de esta guía (**códigos de respuesta, mensajes de error,
nombres de campo y rutas**) fueron verificados ejecutando el flujo contra la API
real, no deducidos del código.

Dos modalidades:

| Modalidad | Cuándo usarla |
|---|---|
| **[A] Con Swagger UI** (`http://localhost:3000/api/v1/api-docs`) | Verificar la API cruda una vez y contrastar qué envía el frontend. |
| **[B] Con el frontend real** | Verificar el comportamiento de la app: validaciones, subida de imágenes, navegación, manejo de errores. |

---

## 0. Preparación

```bash
# 1. Dependencias y base de datos
npm install
docker compose up -d db     # Postgres + PostGIS en el puerto 5432

# 2. Variables de entorno
cp .env.example .env        # completar ENCRYPTION_KEY (32 chars) y JWT_SECRET

# 3. Esquema + datos de prueba
npm run migrate:latest
npm run seed

# 4. Levantar la API
npm start                   # o: npm run dev
```

Sanidad:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/health
```

Ambos devuelven `200`. Si el puerto 3000 está ocupado, levantalo en otro:

```bash
PORT=3999 npm start
```

### Credenciales

Password universal de los usuarios sembrados: `test123!`

| Email | Perfiles |
|---|---|
| `cliente1@test.com` … `cliente5@test.com` | Solo cliente, **con** identidad cargada |
| `worker1@test.com` … `worker5@test.com` | Cliente + trabajador, **con** identidad cargada |

> Los seeds completan la identidad de todos los perfiles, así que **no sirven para
> probar el alta desde cero**. Usá un usuario nuevo (Paso 1), o borrá el perfil de
> uno existente:
>
> ```bash
> curl -X DELETE http://localhost:3000/api/v1/users/<ID>/client-profile \
>   -H "Authorization: Bearer <TOKEN>"
> ```

---

## 1. Obtener un token (⚠️ el login es de dos pasos)

`POST /auth/login` **no devuelve token**: valida las credenciales, manda un OTP y
responde `PENDING_VERIFICATION`. El token sale recién de `verify-otp`.

```bash
# Paso 1.a — dispara el OTP
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente1@test.com","password":"test123!"}'
```

```json
{ "status": "PENDING_VERIFICATION",
  "message": "Código OTP enviado al correo/teléfono registrado.",
  "user": { "id": "…", "email": "cliente1@test.com" } }
```

En desarrollo el OTP **se imprime en el log del backend** (no se envía a un
servicio real). Buscá la última línea `[OTP]` del log del server:

```
[OTP] Email OTP enviado (simulación) Tu código de verificación de 2 pasos es: 468716. Expira en 10 minutos.
```

```bash
# Paso 1.b — canjear el OTP por el token
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente1@test.com","otp_code":"468716"}'
```

```json
{ "message": "Verificación exitosa",
  "accessToken": "eyJhbGciOi…",
  "refreshToken": "…" }
```

> 🔑 **El campo es `accessToken` (camelCase), no `access_token`.** Es el único
> lugar donde la API usa camelCase; el resto de los DTOs van en `snake_case`.

### Crear un usuario nuevo verificado (para el alta desde cero)

El registro dispara OTP por email y teléfono por email y teléfono. Para testing se puede insertar
el usuario ya verificado. El hash se genera con el `bcrypt` del proyecto, porque
la extensión `pgcrypto` **no** está instalada:

```bash
HASH=$(node -e "import('bcrypt').then(b=>console.log(b.default.hashSync('Test1234!',10)))")

docker exec -it ondemand_db psql -U postgres -d ondemand_db -c "
  INSERT INTO users (id, email, phone, password_hash, verified_email, verified_phone, is_verified, active)
  VALUES (gen_random_uuid(), 'nuevo.test@test.com', '+5491199988877',
          '$HASH', true, true, true, true);"
```

Luego seguí con el login de dos pasos usando `nuevo.test@test.com` / `Test1234!`.

> ⚠️ `current_role` es **palabra reservada** en SQL (alias de `CURRENT_USER`):
> siempre entrecomillarla (`SELECT "current_role" FROM users`). Sin comillas da
> error de sintaxis; consultada sin comillas devuelve el rol de la conexión
> (`postgres`) en vez del valor de la columna. En el `INSERT` no hace falta
> listarla: el default es `'client'`, que es justo lo que hay que probar.

### Obtener el `:id` del usuario

```bash
curl http://localhost:3000/api/v1/users/me -H "Authorization: Bearer <TOKEN>"
```

Devuelve el usuario **en el primer nivel** (no envuelto en `user`):

```json
{ "id": "585347c7-…", "email": "nuevo.test@test.com", "current_role": "client",
  "is_verified": true, "verified_email": true, "verified_phone": true, "active": true,
  "created_at": "…", "updated_at": "…", "average_rating": null, "profile": null }
```

---

## 2. Preparar las imágenes

Cualquier JPG/PNG de al menos 100x100 px sirve.

```bash
mkdir -p /tmp/perfil && cd /tmp/perfil
curl -s -o selfie.jpg     "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?fm=jpg&w=800"
curl -s -o dni-frente.jpg "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fm=jpg&w=800"
curl -s -o dni-dorso.jpg  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fm=jpg&w=800"
file *.jpg
```

---

## 3. [A] Verificar la API con Swagger UI

Abrir `http://localhost:3000/api/v1/api-docs` → **Authorize** → pegar el `accessToken` →
ejecutar en orden:

1. **`POST /api/v1/uploads/profile-image`** ×3 (un archivo por llamada). Anotar las `url`.
2. **`POST /api/v1/users/{id}/client-profile`** → `201`.
3. **`POST /api/v1/users/{id}/worker-profile`** con el **mismo** body → `201`.
4. **`GET`** de ambos → los 4 campos de identidad presentes.
5. **`PATCH`** parciales.

---

## 4. [B] Flujo completo desde el frontend

### 4.1 Subir las tres imágenes

Un `POST` por imagen, al elegirla:

```js
const formData = new FormData();
formData.append('file', {
  uri: pickedUri,          // RN: picker de imágenes; web: File
  name: pickedName ?? 'selfie.jpg',
  type: pickedMime ?? 'image/jpeg',
});

const { data } = await axios.post('/api/v1/uploads/profile-image', formData, {
  headers: { Authorization: `Bearer ${accessToken}` },  // sin Content-Type manual
});
const url = data.url;   // "/uploads/profiles/<uuid>.jpg"
```

**Respuesta `201`:**

```json
{ "message": "Imagen subida exitosamente",
  "url": "/uploads/profiles/4c432138-54a6-4f63-b26c-3bcaa43970c1.jpg",
  "size": 2435 }
```

> ⚠️ **No** setear `Content-Type: application/json`: el header correcto lo genera
> el cliente multipart. Si se fuerza, el backend no encuentra el campo `file`.
>
> ⚠️ El campo del token en el login es `accessToken`, no `access_token`.

Para **previsualizar** la imagen, anteponer el origen de la API:

```js
const absoluteUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;  // sin /api/v1
```

**Rechazos verificados:**

| Entrada | Código | `message` |
|---|---|---|
| PDF / HEIC | `400` | `Solo se permiten imágenes JPG o PNG` |
| > 10 MB | `400` | `El archivo no debe superar el límite de tamaño permitido` |
| Sin token | `401` | `Token de acceso inválido o expirado` |

### 4.2 Enviar el perfil de cliente

```js
const { data } = await axios.post(`/api/v1/users/${userId}/client-profile`, {
  full_name: 'Nuevo Tester',
  date_of_birth: '1990-05-14',   // string YYYY-MM-DD exacto: NO Date, NO ISO con Z
  avatar_url: avatarUrl,
  dni_front_url: dniFrontUrl,
  dni_back_url: dniBackUrl,
}, { headers: { Authorization: `Bearer ${accessToken}` } });
```

**Respuesta `201`** — va envuelta en `profile`:

```json
{ "message": "Perfil de cliente creado correctamente",
  "profile": { "id": "…", "user_id": "…", "full_name": "Nuevo Tester",
               "date_of_birth": "1990-05-14", "avatar_url": "/uploads/profiles/…",
               "dni_front_url": "/uploads/profiles/…", "dni_back_url": "/uploads/profiles/…" } }
```

### 4.3 Enviar el perfil de trabajador (mismo token, sin cambiar rol)

```js
const { data } = await axios.post(`/api/v1/users/${userId}/worker-profile`, {
  full_name: 'Nuevo Tester',
  date_of_birth: '1990-05-14',
  avatar_url: avatarUrl,
  dni_front_url: dniFrontUrl,
  dni_back_url: dniBackUrl,
}, { headers: { Authorization: `Bearer ${accessToken}` } });
```

Body **idéntico** al de cliente: sin `category_id`, sin `hourly_rate`, sin
`certification_status`. Sin logout ni `switch-role` en el medio.

**Respuesta `201` verificada** (todos los opcionales vienen con default):

```json
{ "message": "Perfil de trabajador creado correctamente",
  "profile": { "date_of_birth": "1990-05-14",
               "category_id": null,
               "hourly_rate": null,
               "availability_status": "AVAILABLE",
               "certification_status": "PENDING" } }
```

> `hourly_rate` es `null` real, **no** `0`. Este paso devolvía `403` antes de los
> cambios, porque el endpoint exigía rol activo `worker` y el `switch-role` exige
> a su vez un trabajador con certificación aprobada.

### 4.4 Verificar con GET

```js
const { data: cliente } = await axios.get(`/api/v1/users/${userId}/client-profile`, { headers });
const { data: worker }   = await axios.get(`/api/v1/users/${userId}/worker-profile`, { headers });
```

Estos GET devuelven el objeto **directo, sin envoltorio** `profile`:

```
id, user_id, full_name, date_of_birth, avatar_url, dni_front_url, dni_back_url,
bio, default_location_id, preferences, created_at, updated_at
```

```js
cliente.date_of_birth === '1990-05-14';   // true
```

La fecha viene en `YYYY-MM-DD` **sin `Z` ni componente horario**, así que se
puede comparar como string sin parsear.

---

## 5. Checklist de lo que hay que ver en pantalla

| # | Acción | Resultado esperado (verificado) |
|---|---|---|
| 1 | Abrir onboarding con usuario **sin** perfiles | `404 CLIENT_PROFILE_NOT_FOUND` / `404 WORKER_PROFILE_NOT_FOUND` |
| 2 | Elegir un PDF como foto | `400` · `Solo se permiten imágenes JPG o PNG` |
| 3 | Elegir un archivo > 10 MB | `400` · `El archivo no debe superar el límite de tamaño permitido` |
| 4 | Enviar sin elegir las fotos | `400` · `La URL de la imagen es requerida` |
| 5 | Fecha `14/05/1990`, `1990-5-4`, `1990`, `1990-05` o `1990-05-14T10:00:00Z` | `400` · `La fecha de nacimiento debe tener formato ISO (YYYY-MM-DD)` |
| 6 | Fecha `1990-02-31` o `2023-02-29` | `400` · `La fecha de nacimiento debe ser una fecha válida` |
| 7 | Fecha futura (`2030-01-01`) | `400` · `La fecha de nacimiento no puede ser futura` |
| 8 | Fecha `1899-12-31` | `400` · `La fecha de nacimiento debe ser posterior al 01/01/1900` |
| 9 | Avatar `file:///data/user/0/com.app/files/selfie.jpg` | `400` · `La URL de la imagen debe ser una URL pública JPG o PNG válida (no se aceptan URIs locales file:// o content://)` |
| 10 | Guardar los dos perfiles seguidos | Ambos `201` con el mismo token |
| 11 | Cambiar solo el avatar (`PATCH`) | `200`; los otros campos siguen |
| 12 | Cambiar solo la fecha (`PATCH`) | `200`; el valor nuevo exacto se persiste |
| 13 | Verificar la fecha en la BD | Devuelve **el mismo día** |
| 14 | Volver a cargar la app | Los 4 campos se ven en ambos perfiles |

> Los mensajes de `avatar_url`, `dni_front_url` y `dni_back_url` son **el mismo**
> (`La URL de la imagen es requerida`): Joi no distingue el campo. Si querés
> que la UI marque el input exacto, mapeá el campo faltante en el cliente.

### Comprobación de timezone (caso 13)

```bash
docker exec -it ondemand_db psql -U postgres -d ondemand_db -c \
  "SELECT date_of_birth FROM client_profiles WHERE user_id='<ID>';"
```

Debe devolver exactamente la fecha enviada. Antes de los cambios devolvía un día
menos en UTC-3: Joi convertía el string a un `Date` en medianoche UTC y `pg`
serializaba a columna `date` con la fecha local.

---

## 6. PATCH parcial

```bash
curl -X PATCH http://localhost:3000/api/v1/users/<ID>/client-profile \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"avatar_url":"/uploads/profiles/nuevo-avatar.jpg"}'

curl -X PATCH http://localhost:3000/api/v1/users/<ID>/worker-profile \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"hourly_rate":9500,"availability_status":"AVAILABLE"}'
```

Respuesta `200` con el mismo envoltorio que el `POST`: `{ "message": …, "profile": { … } }`.
Los campos omitidos conservan su valor (verificado: cambiar la tarifa no borra
`date_of_birth` ni los DNI, y cambiar la fecha no borra la tarifa).

---

## 7. Casos de error a verificar

| Caso | Esperado |
|---|---|
| Perfil inexistente (`GET`) | `404 CLIENT_PROFILE_NOT_FOUND` / `404 WORKER_PROFILE_NOT_FOUND` |
| Perfil de otro usuario | `403 FORBIDDEN` |
| Perfil duplicado (`POST` 2 veces) | `409` |
| Sin token | `401 UNAUTHORIZED` |
| Sin `date_of_birth` | `400` · `La fecha de nacimiento es requerida` |
| Sin ninguna imagen | `400` · `La URL de la imagen es requerida` |
| Fecha con formato no ISO | `400` · `…debe tener formato ISO (YYYY-MM-DD)` |
| Fecha inexistente en calendario | `400` · `…debe ser una fecha válida` |

Todos los errores usan la misma forma:

```json
{ "error": "VALIDATION_ERROR", "message": "…", "statusCode": 400,
  "timestamp": "2026-10-02T23:22:25.981Z" }
```

---

## 8. Verificar los archivos en disco

```bash
ls -la uploads/profiles/
```

Deben aparecer **3 archivos `<uuid>.jpg`** por cada alta completa (todos se
normalizan a JPEG). Reemplazar el avatar con `PATCH` **no** borra el archivo
anterior: la limpieza de imágenes de perfil no está implementada.

---

## 9. Probar desde el teléfono con Expo Go

El backend se levanta en Docker (`ondemand_api`) y publica el puerto 3000 en
todas las interfaces, así que el teléfono lo alcanza por la **IP LAN de la
máquina**, no por `localhost`.

### Configuración verificada

> `<IP-LAN>` es la IP de **tu** máquina en la red local; cambia según la red y el
> equipo. Obtenela con `hostname -I | awk '{print $1}'` (Linux) o
> `ipconfig getifaddr en0` (macOS).

| Dato | Valor |
|---|---|
| IP LAN del host | `<IP-LAN>` |
| URL base para la app | `http://<IP-LAN>:3000/api/v1` |
| Origen estático de imágenes | `http://<IP-LAN>:3000` (sin `/api/v1`) |

En el frontend, el `.env` debe quedar:

```bash
EXPO_PUBLIC_API_URL=http://<IP-LAN>:3000/api/v1
```

> Si preferís un túnel de Cloudflare, funciona igual y sirve desde 4G, pero hay que
> actualizar `EXPO_PUBLIC_API_URL` con la URL nueva cada vez que se levanta, y da
> HTTPS. Con la IP LAN no hay nada que renovar, pero el teléfono tiene que estar en
> la **misma red** que la máquina.

### Verificar desde la PC antes de tocar el teléfono

Estos comandos prueban exactamente el camino que va a usar el móvil:

```bash
# 1. La API responde por la IP LAN
curl http://<IP-LAN>:3000/api/v1/health          # → 200

# 2. La migración está aplicada (si falta, el alta de perfil da 500)
docker exec ondemand_db psql -U postgres -d ondemand_db -c \
  "SELECT count(*) FROM information_schema.columns
   WHERE column_name IN ('date_of_birth','dni_front_url','dni_back_url');"
# → 6 (3 columnas × 2 tablas)

# 3. CORS acepta el origen de Metro y rechaza los demás
curl -o /dev/null -w "%{http_code}\n" -H "Origin: http://localhost:8081" \
  http://<IP-LAN>:3000/api/v1/health               # → 200
curl -o /dev/null -w "%{http_code}\n" -H "Origin: https://ajeno.com" \
  http://<IP-LAN>:3000/api/v1/health               # → 403

# 4. Una imagen subida se sirve por la IP LAN (imprescindible para el <Image>)
curl -o /dev/null -w "%{http_code} %{content_type}\n" \
  http://<IP-LAN>:3000/uploads/profiles/<uuid>.jpg  # → 200 image/jpeg
```

### ⚠️ La app todavía no puede guardar el perfil

Aunque el backend esté impecable, el flujo **no va a funcionar desde la app**
hasta que el frontend implemente la subida. `src/hooks/useCompleteProfile.ts`
es un stub con tres problemas:

1. Envía `avatar_url: formData.selfieUri`, que es el **URI local** del picker
   (`file://…`) → el backend responde `400`.
2. **No envía** `date_of_birth`, `dni_front_url` ni `dni_back_url` → `400`.
3. Envuelve todo en un `catch` que hace `setStatus("success")` igual, con el
   comentario *"Mostramos éxito igual porque el backend aún no persiste"*.

Resultado: la pantalla va a mostrar **perfil completado** y la base va a quedar
vacía. Para confirmar contra la base:

```bash
docker exec ondemand_db psql -U postgres -d ondemand_db -c \
  "SELECT u.email, c.date_of_birth FROM users u
   JOIN client_profiles c ON c.user_id = u.id ORDER BY u.created_at DESC LIMIT 5;"
```

Además `category_id: "cat-001"` (el stub lo manda hardcodeado) no es un UUID y
produciría `500 invalid input syntax for type uuid`.

### Orden correcto de llamadas desde la app

```
1. expo-image-picker → URI local (file://…)          ← NO se manda al backend
2. POST /uploads/profile-image  (FormData con el file)
      → { "url": "/uploads/profiles/<uuid>.jpg" }
3. anteponer el origen a esa URL para mostrarla:
      http://<IP-LAN>:3000/uploads/profiles/<uuid>.jpg
4. POST /users/:id/client-profile  (o worker-profile) con los 4 campos
```

El `FormData` **no** debe llevar `Content-Type` manual: el cliente genera el
boundary.

### CORS

React Native **no** manda header `Origin` en peticiones nativas, así que desde
Expo Go no debería hacer falta configurar nada (se verificó que la petición sin
`Origin` devuelve `200`). Expo Web y Metro sí lo mandan.

Si aun así aparece `403 CORS_ERROR`, el origen exacto no está en la lista y hay
que agregarlo a `ALLOWED_ORIGINS` en el `.env` y recrear el contenedor:

```bash
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081,http://<IP-LAN>:8081,exp://<IP-LAN>:8081

docker compose up -d --force-recreate api
```

> La lista se compara **exactamente**. Si cambia la IP LAN de la máquina, hay que
> actualizar ese valor. `docker-compose.yml` interpola `ALLOWED_ORIGINS` desde el
> `.env`, con fallback al valor de `.env.example`.

---

## 10. Troubleshooting

| Síntoma | Causa | Solución |
|---|---|---|
| `403 Token de acceso inválido o expirado` | Usás `data.access_token` del login | El campo es `accessToken` y viene de `verify-otp`, no de `login` |
| El login responde `PENDING_VERIFICATION` y no hay token | Es el flujo normal | Canjear el OTP con `POST /auth/verify-otp` |
| No encontrás el OTP | Está en el log del server | Buscar `[OTP]` en la consola del backend |
| `400 multer` sin detalle | `Content-Type: application/json` forzado | Dejar que el cliente fije el boundary multipart |
| `404` con el perfil ya creado | Leíste `data.profile.url` en vez de `data.url` | El upload responde `{ message, url, size }`, sin envoltorio |
| La fecha guardada es un día menor | Mandás un `Date` de JS | Enviar `YYYY-MM-DD` como **string** |
| `403` al crear el worker-profile | JWT de otro usuario | Usar el token del mismo `:id` |
| `500` con `hourly_rate` | Migración no aplicada | `npm run migrate:latest` |
| La imagen no se ve en la app | URL relativa | Anteponer el origen: `${API_BASE_URL}${url}` |
| `EADDRINUSE` al arrancar | Otro proceso en el 3000 | `PORT=3999 npm start` |
| `npm run seed` falla | — | Verificar que `clear.js` esté en `src/database/`, no en `src/database/seeds/` |

---

## 11. Checklist final

- [ ] Las 3 imágenes suben (`201`) y se previsualizan.
- [ ] Se crea el perfil de cliente con los 4 campos.
- [ ] Se crea el perfil de trabajador con los 4 campos, **con el mismo token**.
- [ ] Ambos GET devuelven los 4 campos en `YYYY-MM-DD`.
- [ ] La fecha coincide exactamente con la enviada, en pantalla y en la BD.
- [ ] Los PATCH parciales no borran los otros campos.
- [ ] Los 7 casos de error de la sección 7 devuelven el código esperado.
- [ ] Volver a cargar la app conserva todo.
