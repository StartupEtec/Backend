/**
 * Adds suggested_budget and scheduled_date to orders (frontend issue #17).
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.decimal('suggested_budget', 10, 2).nullable();
    table.date('scheduled_date').nullable();
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('suggested_budget');
    table.dropColumn('scheduled_date');
  });
}
