/**
 * Añade estado por participante de marcado de favoritos y archivado de chats.
 *
 * Se colocan en `chat_participants` (y no en `chats`) porque favorito/archivado son
 * preferencias individuales: marcar o archivar un chat es una decisión de un único
 * usuario que no debe afectar a la conversación del otro participante. Esto es
 * coherente con `last_read_at` y `deleted_at`, ya por participante.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('chat_participants', (table) => {
    table.boolean('is_favorite').defaultTo(false).notNullable();
    table.boolean('is_archived').defaultTo(false).notNullable();
  });

  // Índice compuesto para acelerar el listado según estado de cada participante
  await knex.schema.alterTable('chat_participants', (table) => {
    table.index(['user_id', 'is_favorite']);
    table.index(['user_id', 'is_archived']);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('chat_participants', (table) => {
    table.dropIndex(['user_id', 'is_favorite']);
    table.dropIndex(['user_id', 'is_archived']);
    table.dropColumn('is_favorite');
    table.dropColumn('is_archived');
  });
}
