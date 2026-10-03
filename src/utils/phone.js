import { parsePhoneNumberFromString, getCountries, getCountryCallingCode } from 'libphonenumber-js';

/**
 * Calling code por defecto cuando `DEFAULT_PHONE_COUNTRY_CODE` no está definido.
 *
 * +54 (Argentina) para que coincida con `.env.example`, con los seeds
 * (`+5491144441111`) y con los datos reales de la plataforma.
 *
 * Antes este default era +57 (Colombia), lo que producía dos bugs:
 *   1. Con datos argentinos, un móvil en formato nacional se canonicalizaba mal.
 *   2. `DEFAULT_PHONE_COUNTRY_CODE` se leía en el ámbito del módulo, que se
 *      evalúa ANTES del `dotenv.config()` de src/app.js. O sea, el valor del .env
 *      nunca se usaba en runtime: siempre ganaba este fallback.
 */
const FALLBACK_CALLING_CODE = '54';

/**
 * Caché de calling code -> ISO 3166-1 alpha-2. Se construye bajo demanda (no al
 * cargar el módulo) por el mismo problema de orden de carga que arriba: leer
 * `process.env` en el ámbito del módulo es leerlo demasiado tarde.
 */
let callingCodeToCountry = null;

function buildCallingCodeMap() {
  const map = new Map();
  for (const country of getCountries()) {
    const code = getCountryCallingCode(country);
    if (!code) continue;
    // Ante varios países con el mismo calling code (p.ej. 1 -> US/CA), el primero
    // que aparece es el principal, que es el que interesa como default.
    if (!map.has(code)) map.set(code, country);
  }
  return map;
}

/**
 * Resuelve el país por defecto desde `DEFAULT_PHONE_COUNTRY_CODE` (acepta `+54`,
 * `54` o `0054`). Se lee del env en cada llamada a propósito, para no depender del
 * orden en que se cargan los módulos.
 * @returns {string|undefined} ISO alpha-2, o undefined si no se puede determinar.
 */
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
 * Canonicaliza un número de teléfono a formato E.164 (+<countryCode><número>).
 *
 * El parsing (móvil vs. fijo, prefijos de área, formato nacional con el cero de
 * apertura, sufijo 15 de los móviles argentinos, etc.) lo aporta
 * `libphonenumber-js` con sus metadatos validados, en lugar de heurísticas propias
 * que solo eran correctas para un país.
 *
 * Acepta:
 *   - Formato internacional explícito: '+5491123456789', '00 54 9 11...'
 *   - Formato nacional: '011 15-1234-5678', '1122334455', '(300) 123-45-67'
 *
 * Devuelve null para valores vacíos, no-string o no parseables. El caller decide
 * cómo reportarlo (la capa de validación Joi lo traduce a VALIDATION_ERROR).
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function canonicalPhone(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  // Solo dígitos, guiones, espacios, paréntesis o un '+': si hay letras u otros
  // símbolos, no es un teléfono.
  if (!/^[+\d\s().-]+$/.test(raw.trim())) {
    return null;
  }

  const country = resolveDefaultCountry();
  let parsed = parsePhoneNumberFromString(raw.trim(), country);

  // Invariante de E.164: el número nacional significativo NUNCA empieza con 0 (el 0
  // es prefijo de línea nacional). Si se coló, el parseo produjo basura:
  // '03001234567' en CO salía como '+5703001234567'. Se reintenta sin él.
  if (parsed && nationalNumberOf(parsed).startsWith('0')) {
    const sinCero = nationalNumberOf(parsed).replace(/^0+/, '');
    parsed = sinCero ? parsePhoneNumberFromString(sinCero, country) : null;
  }

  if (!parsed) {
    return null;
  }

  // `isValid()` exige que el número exista en los metadatos del país; `isPossible()`
  // es más permisivo (solo longitud y forma). Se aceptan ambos para no romper
  // números legítimos que la librería no tiene asignados, pero el resultado siempre
  // queda en E.164 estricto.
  if (!parsed.isValid() && !parsed.isPossible()) {
    return null;
  }

  return parsed.number;
}

export default canonicalPhone;
