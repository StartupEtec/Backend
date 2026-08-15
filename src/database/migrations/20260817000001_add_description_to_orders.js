/**
 * Agrega columna description a orders para Issue #22.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.text('description').nullable();
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('description');
  });
}
