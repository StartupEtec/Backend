const DEFAULT_COUNTRY_CODE = (process.env.DEFAULT_PHONE_COUNTRY_CODE || '+57').replace('+', '');

/**
 * Canonicaliza un número de teléfono a formato E.164 (+<countryCode><número>).
 *
 * Reglas aplicadas en orden:
 *  1. Se eliminan todos los caracteres no numéricos (espacios, guiones, paréntesis).
 *  2. Se resuelve el prefijo internacional: '+' explícito, '00' o ausente.
 *  3. Se eliminan ceros a la izquierda que suelen acompañar a prefijos nacionales.
 *  4. Si el número no incluía código de país explícito ni comienza con el código de
 *     país por defecto, se antepone DEFAULT_PHONE_COUNTRY_CODE.
 *
 * Devuelve null para valores vacíos o sin dígitos (el caller decide cómo reportarlo).
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function canonicalPhone(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  let digits = raw.replace(/[^\d+]/g, '');
  let explicitCountryCode = false;

  if (!digits) {
    return null;
  }

  if (digits.startsWith('+')) {
    digits = digits.slice(1);
    explicitCountryCode = true;
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
    explicitCountryCode = true;
  }

  while (digits.startsWith('0') && digits.length > 1) {
    digits = digits.slice(1);
  }

  if (!digits) {
    return null;
  }

  if (!explicitCountryCode && !digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    digits = DEFAULT_COUNTRY_CODE + digits;
  }

  return `+${digits}`;
}

export default canonicalPhone;
