/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Contador persistente de intentos OTP fallidos por código/usuario (ver OtpService).
  // Permite invalidar el OTP tras N intentos sin depender de la memoria del proceso.
  await knex.schema.alterTable('users', (table) => {
    table.integer('otp_failed_attempts').notNullable().defaultTo(0);
  });

  // Backfill: canonicalizar teléfonos existentes a E.164.
  // Regla (idéntica a la canonicalización en runtime de src/utils/phone.js):
  //   - Filas solo-dígitos (8-15) se les quita el cero nacional de apertura.
  //   - Si el resultado ya comienza con el código de país por defecto (almacenado
  //     sin '+'), solo se antepone '+'; de lo contrario se antepone '+' + código.
  // Limitación: números internacionales almacenados sin '+' no se distinguen de
  // números locales; se asumen locales (contexto de país único de la plataforma).
  const countryCode = (process.env.DEFAULT_PHONE_COUNTRY_CODE || '+57').replace(/\D/g, '');
  await knex.raw(
    `UPDATE users SET phone = CASE
        WHEN regexp_replace(phone, '^0+', '') ~ ('^' || ?) THEN '+' || regexp_replace(phone, '^0+', '')
        ELSE '+' || ? || regexp_replace(phone, '^0+', '')
      END
     WHERE phone ~ '^[0-9]{8,15}$'`,
    [countryCode, countryCode],
  );
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // No se revierte el formato del teléfono (operación de datos no reversible),
  // solo se elimina el contador.
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('otp_failed_attempts');
  });
}
