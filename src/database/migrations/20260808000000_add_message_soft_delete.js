/**
 * Soft delete de mensajes + índices de paginación.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('messages', (table) => {
    table.timestamp('deleted_at');
  });

  // Índice compuesto para el listado paginado de mensajes de un chat
  await knex.raw('CREATE INDEX messages_chat_created_idx ON messages (chat_id, created_at DESC)');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS messages_chat_created_idx');

  await knex.schema.alterTable('messages', (table) => {
    table.dropColumn('deleted_at');
  });
}
