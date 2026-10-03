import { createHash } from 'node:crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deriva un UUID v4 válido y estable a partir de un slug legible.
 *
 * Las columnas `id` son `uuid` en Postgres, así que un identificador legible
 * pero inválido (por ejemplo `cp111111-1111-4111-8111-111111111111`, cuyo
 * primer grupo no es hexadecimal) aborta el seed completo. Los seeds usan
 * slugs legibles y delegan la derivación acá.
 *
 * El mismo slug siempre devuelve el mismo UUID, de modo que las referencias
 * cruzadas entre archivos de seed siguen apuntando al mismo registro. Un slug
 * que ya es un UUID válido se devuelve sin transformar.
 *
 * @param {string} slug Identificador legible, por ejemplo `'cp-111111'`.
 * @returns {string} UUID v4 en minúsculas.
 */
export function seedId(slug) {
  if (UUID_REGEX.test(slug)) return slug.toLowerCase();

  const hash = createHash('sha256').update(`seed:${slug}`).digest('hex');

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

export default seedId;
