/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Tabla de notificaciones: registro centralizado de todos los envíos
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table
      .string('type')
      .notNullable()
      .comment(
        'Tipo de evento: SERVICE_REQUEST, QUOTE_RECEIVED, QUOTE_ACCEPTED, SERVICE_COMPLETED, NEW_MESSAGE, ORDER_STATUS_CHANGE',
      );
    table.jsonb('channels').notNullable().comment('Canales objetivo: ["push", "email", "sms"]');
    table.string('title').notNullable();
    table.text('body').notNullable();
    table.jsonb('data').nullable().comment('Payload adicional: order_id, chat_id, quote_id, etc.');
    table
      .string('status')
      .defaultTo('PENDING')
      .notNullable()
      .comment('PENDING, SENT, FAILED, READ');
    table.timestamp('read_at').nullable();
    table.text('failed_reason').nullable();
    table.integer('retry_count').defaultTo(0).notNullable();
    table.integer('max_retries').defaultTo(3).notNullable();
    table.timestamps(true, true);

    table.index(['user_id']);
    table.index(['status']);
    table.index(['type']);
    table.index(['created_at']);
    table.index(['user_id', 'status']);
  });

  // Tabla de preferencias de notificación por usuario
  await knex.schema.createTable('notification_preferences', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .unique()
      .notNullable();
    table.boolean('push_enabled').defaultTo(true).notNullable();
    table.boolean('email_enabled').defaultTo(true).notNullable();
    table.boolean('sms_enabled').defaultTo(false).notNullable();
    table.time('dnd_start').nullable().comment('Hora de inicio del horario de no molestar (HH:MM)');
    table.time('dnd_end').nullable().comment('Hora de fin del horario de no molestar (HH:MM)');
    table.boolean('dnd_enabled').defaultTo(false).notNullable();
    table
      .jsonb('channels_config')
      .nullable()
      .comment('Configuración adicional por tipo de notificación');
    table.timestamps(true, true);

    table.index(['user_id']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('notification_preferences');
  await knex.schema.dropTableIfExists('notifications');
}
