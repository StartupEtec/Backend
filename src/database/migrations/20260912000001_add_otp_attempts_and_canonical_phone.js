/**
 * Agrega el contador persistente de intentos OTP fallidos por usuario.
 *
 * IMPORTANTE (cambio 2026-10-01): esta migración antes também hacía un backfill de
 * `users.phone` con un UPDATE en SQL que *adivinaba* el país:
 *
 *   UPDATE users SET phone = '+' || <DEFAULT_PHONE_COUNTRY_CODE> || phone
 *    WHERE phone ~ '^[0-9]{8,15}$'
 *
 * Eso era destructivo. Con el fallback `+57` hardcodeado, cualquier teléfono
 * argentino guardado sin '+' se convertía en basura:
 *
 *   '5491144441111' -> '+575491144441111'   (15 dígitos, no existe)
 *   '91144441111'   -> '+5791144441111'     (no existe)
 *
 * Y como `users.phone` es UNIQUE, el usuario queda sin poder loguearse por
 * teléfono. Peor: `down()` no revierte el cambio de datos, así que una vez
 * ejecutada con el default equivocado la corrupción es permanente.
 *
 * Por eso la canonicalización de teléfonos se movió a su propia migración,
 * `20261001000001_recanonicalize_phones_e164`, que usa el parsing real de
 * libphonenumber-js y aborta ante colisiones en vez de adivinar.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.integer('otp_failed_attempts').notNullable().defaultTo(0);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('otp_failed_attempts');
  });
}
