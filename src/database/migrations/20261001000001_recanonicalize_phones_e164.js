import { parsePhoneNumberFromString, getCountries, getCountryCallingCode } from 'libphonenumber-js';

/**
 * Re-canonicaliza `users.phone` a E.164, reparando los teléfonos que las
 * migraciones anteriores guardaron mal.
 *
 * Por qué hace falta: la canonicalización original era una heurística propia que
 * solo era correcta para un país, y leía `DEFAULT_PHONE_COUNTRY_CODE` en el ámbito
 * del módulo (es decir, antes del `dotenv.config()` de src/app.js, así que el .env
 * nunca se aplicaba y siempre ganaba el fallback +57). Con esos defaults:
 *
 *   '011 15-1234-5678' -> '+54111512345678'   (no existe; el correcto es +5491112345678)
 *
 * Como `users_phone_unique` es UNIQUE y el login busca por teléfono, esos usuarios
 * no pueden volver a entrar.
 *
 * El parsing se replica acá con `libphonenumber-js` en lugar de importar
 * `src/utils/phone.js` a propósito: una migración debe congelar la lógica con la que
 * se ejecutó, no depender de código de app que puede cambiar después. Si el runtime
 * cambia, esta migración sigue siendo reproducible.
 *
 * DISEÑO DEFENSIVO — esta migración escribe sobre datos reales, así que no adivina:
 *   1. Solo reescribe una fila si el número parsea y es `isValid()` en los
 *      metadatos de libphonenumber. Un número que solo es `isPossible()` (largo y
 *      forma plausibles) NO se toca: se reporta para revisión manual. Antes, un
 *      UPDATE en SQL de la migración 20260912000001 convertía '5491144441111' en
 *      '+575491144441111' sin ninguna validación.
 *   2. Detecta colisiones de `users_phone_unique` ANTES de escribir, y aborta. Es
 *      preferible detener el deploy con un error claro que aplicar cambios a medias.
 *   3. Es idempotente: canonicalizar un teléfono ya canónico devuelve el mismo
 *      valor, así que volver a correrla no cambia nada.
 *
 * El nombre del archivo importa: se registra en `knex_migrations` al aplicarse, y las
 * DBs ya migradas lo tienen registrado con este nombre exacto.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

const FALLBACK_CALLING_CODE = '54';

let callingCodeToCountry = null;

function buildCallingCodeMap() {
  const map = new Map();
  for (const country of getCountries()) {
    const code = getCountryCallingCode(country);
    if (code && !map.has(code)) map.set(code, country);
  }
  return map;
}

function resolveDefaultCountry() {
  const configured = (process.env.DEFAULT_PHONE_COUNTRY_CODE || '').replace(/\D/g, '');
  if (!callingCodeToCountry) {
    callingCodeToCountry = buildCallingCodeMap();
  }
  return callingCodeToCountry.get(configured || FALLBACK_CALLING_CODE);
}

/** Parte nacional de un E.164, recortando exactamente el calling code. */
function nationalNumberOf(parsed) {
  const calling = String(parsed.countryCallingCode ?? '');
  if (calling && parsed.number.startsWith(`+${calling}`)) {
    return parsed.number.slice(calling.length + 1);
  }
  return parsed.number.replace(/^\+/, '');
}

/**
 * @returns {{ canonical: string, confident: boolean } | null}
 *   `confident` = el número es `isValid()` en libphonenumber. Solo en ese caso se
 *   considera seguro reescribir la fila.
 */
function analyzePhone(raw, country) {
  if (!raw || typeof raw !== 'string') return null;
  if (!/^[+\d\s().-]+$/.test(raw.trim())) return null;

  let parsed = parsePhoneNumberFromString(raw.trim(), country);

  // El NSN nunca empieza con 0 (el 0 es prefijo de línea nacional).
  if (parsed && nationalNumberOf(parsed).startsWith('0')) {
    const sinCero = nationalNumberOf(parsed).replace(/^0+/, '');
    parsed = sinCero ? parsePhoneNumberFromString(sinCero, country) : null;
  }

  if (!parsed) return null;
  if (!parsed.isValid() && !parsed.isPossible()) return null;

  return { canonical: parsed.number, confident: parsed.isValid() };
}

export async function up(knex) {
  const defaultCountry = resolveDefaultCountry();
  const users = await knex('users').select('id', 'phone').whereNotNull('phone');

  const updates = [];
  const needsReview = [];
  const unparseable = [];

  for (const user of users) {
    const analysis = analyzePhone(user.phone, defaultCountry);

    if (!analysis) {
      unparseable.push({ id: user.id, phone: user.phone });
    } else if (!analysis.confident) {
      // Posible pero no asignado: no se toca solo, se reporta.
      needsReview.push({ id: user.id, phone: user.phone, candidate: analysis.canonical });
    } else if (analysis.canonical !== user.phone) {
      updates.push({ id: user.id, from: user.phone, to: analysis.canonical });
    }
  }

  // Detectar colisiones ANTES de escribir: `users_phone_unique` haría fallar la
  // migración a mitad de camino.
  const targetCounts = new Map();
  for (const update of updates) {
    targetCounts.set(update.to, (targetCounts.get(update.to) || 0) + 1);
  }
  const internalDuplicates = new Set(
    [...targetCounts.entries()].filter(([, count]) => count > 1).map(([to]) => to),
  );

  // Solo hace falta consultar la tabla si no hay duplicados internos; si los hay, la
  // migración va a fallar igual.
  const rowsHoldingTargets = internalDuplicates.size
    ? []
    : await knex('users')
        .select('id', 'phone')
        .whereIn('phone', [...targetCounts.keys()]);

  const collisions = [
    ...[...internalDuplicates].map((to) => ({ to, with: 'otra fila del mismo lote' })),
    ...rowsHoldingTargets
      .filter((row) => !updates.some((u) => u.to === row.phone && u.id === row.id))
      .map((row) => ({ to: row.phone, with: `fila existente ${row.id}` })),
  ];

  if (collisions.length > 0) {
    throw new Error(
      `No se puede canonicalizar (${defaultCountry}): colisión con users_phone_unique -> ` +
        `${JSON.stringify(collisions)}. Resolvé los teléfonos duplicados a mano y volvé a correr la migración.`,
    );
  }

  for (const update of updates) {
    await knex('users').where({ id: update.id }).update({ phone: update.to });
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[migration 20261001000001] país=${defaultCountry} | reparados=${updates.length} ` +
      `| para revisión manual=${needsReview.length} | no parseables=${unparseable.length}`,
  );

  if (needsReview.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[migration 20261001000001] NO se tocaron ${needsReview.length} teléfono(s) que solo son ` +
        `posibles (no confirmados por libphonenumber). Revisalos a mano: ` +
        JSON.stringify(needsReview),
    );
  }

  if (unparseable.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[migration 20261001000001] ${unparseable.length} teléfono(s) no se pudieron parsear y ` +
        `quedaron sin cambios: ${JSON.stringify(unparseable)}`,
    );
  }
}

/**
 * No se revierte: la forma original del teléfono no es recuperable desde E.164, y
 * volver a agregar el prefijo de país a ciegas reproduciría la corrupción que esta
 * migración existe para arreglar.
 * @returns { Promise<void> }
 */
export async function down() {
  // No-op intencional.
}
