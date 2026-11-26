/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Tabla chat_participants: estado por participante (último mensaje leído + soft delete por usuario)
  await knex.schema.createTable('chat_participants', (table) => {
    table.uuid('chat_id').references('id').inTable('chats').onDelete('CASCADE').notNullable();
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.timestamp('last_read_at');
    table.timestamp('deleted_at');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.primary(['chat_id', 'user_id']);
    table.index(['user_id']);
  });

  // 2. Canonicalizar pares existentes: garantizar user_id_1 < user_id_2
  await knex.raw(`
    UPDATE chats SET
      user_id_1 = LEAST(user_id_1, user_id_2),
      user_id_2 = GREATEST(user_id_1, user_id_2)
    WHERE user_id_1 > user_id_2
  `);

  // 3. Eliminar duplicados que quedaron en ambos sentidos (se conserva el de menor id)
  await knex.raw(`
    DELETE FROM chats a USING chats b
    WHERE a.user_id_1 = b.user_id_1
      AND a.user_id_2 = b.user_id_2
      AND a.id > b.id
  `);

  // 4. Índice único por pareja ordenada: garantiza un solo chat por par de usuarios
  await knex.schema.alterTable('chats', (table) => {
    table.unique(['user_id_1', 'user_id_2']);
  });

  // 5. Backfill de participantes desde chats existentes
  await knex.raw(`
    INSERT INTO chat_participants (chat_id, user_id, created_at)
    SELECT id, user_id_1, NOW() FROM chats
    ON CONFLICT (chat_id, user_id) DO NOTHING
  `);
  await knex.raw(`
    INSERT INTO chat_participants (chat_id, user_id, created_at)
    SELECT id, user_id_2, NOW() FROM chats
    ON CONFLICT (chat_id, user_id) DO NOTHING
  `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('chat_participants');

  await knex.schema.alterTable('chats', (table) => {
    table.dropUnique(['user_id_1', 'user_id_2']);
  });
}
