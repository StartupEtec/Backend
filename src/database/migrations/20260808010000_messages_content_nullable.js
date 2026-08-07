/**
 * Permite que `messages.content` sea NULL para mensajes de tipo IMAGE.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('messages', (table) => {
    table.text('content').nullable().alter();
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('messages', (table) => {
    table.text('content').notNullable().alter();
  });
}
