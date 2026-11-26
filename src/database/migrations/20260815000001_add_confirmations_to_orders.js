/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Agrega columnas para rastrear confirmaciones duales de completado de servicio
  await knex.schema.alterTable('orders', (table) => {
    table.boolean('client_confirmed').defaultTo(false).notNullable();
    table.boolean('worker_confirmed').defaultTo(false).notNullable();
    table.uuid('client_confirmed_by').references('id').inTable('users').onDelete('SET NULL');
    table.uuid('worker_confirmed_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('client_confirmed_at');
    table.timestamp('worker_confirmed_at');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('client_confirmed');
    table.dropColumn('worker_confirmed');
    table.dropColumn('client_confirmed_by');
    table.dropColumn('worker_confirmed_by');
    table.dropColumn('client_confirmed_at');
    table.dropColumn('worker_confirmed_at');
  });
}
