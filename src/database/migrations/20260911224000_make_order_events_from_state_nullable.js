/**
 * Permite que `order_events.from_state` sea NULL (eventos sin estado previo,
 * p. ej. el primer evento de una orden).
 * Nota: el nombre exacto del archivo debe preservarse porque quedó registrado
 * en `knex_migrations` (batch 2) de los entornos ya migrados.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('order_events', (table) => {
    table.string('from_state').nullable().alter();
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('order_events', (table) => {
    table.string('from_state').notNullable().alter();
  });
}
