/**
 * Crea la tabla pending_user_changes para almacenar las solicitudes temporales
 * de cambio de correo electrónico y teléfono móvil, que requieren doble OTP.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('pending_user_changes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.string('type').notNullable(); // 'EMAIL' o 'PHONE'
    table.string('new_value').notNullable();
    table.string('current_otp_code').notNullable();
    table.string('new_otp_code').notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);

    table.index(['user_id']);
    table.index(['type']);
  });

  await knex.raw(`
    ALTER TABLE pending_user_changes
    ADD CONSTRAINT pending_user_changes_type_check
    CHECK (type IN ('EMAIL', 'PHONE'))
  `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('pending_user_changes');
}
