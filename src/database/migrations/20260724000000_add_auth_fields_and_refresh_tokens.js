/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Modificar la tabla users para añadir campos de autenticación/OTP y rol
  await knex.schema.alterTable('users', (table) => {
    table.string('otp_code').nullable();
    table.timestamp('otp_expires_at').nullable();
    table.boolean('is_verified').defaultTo(false).notNullable();
    // current_role: rol activo del usuario en la sesión ('client' | 'worker').
    // Incluido en el payload del JWT para el middleware de autorización por roles.
    table.string('current_role').defaultTo('client').notNullable();
  });

  // 2. Crear la tabla refresh_tokens
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.string('jti').unique().notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['user_id']);
    table.index(['jti']);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('refresh_tokens');

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('current_role');
    table.dropColumn('otp_code');
    table.dropColumn('otp_expires_at');
    table.dropColumn('is_verified');
  });
}
