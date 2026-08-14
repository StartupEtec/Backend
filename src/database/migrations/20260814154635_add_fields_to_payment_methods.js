/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('payment_methods', (table) => {
    table.string('cardholder_name').notNullable().defaultTo('');
    table.string('encrypted_card_number').notNullable().defaultTo('');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('payment_methods', (table) => {
    table.dropColumn('cardholder_name');
    table.dropColumn('encrypted_card_number');
  });
}
