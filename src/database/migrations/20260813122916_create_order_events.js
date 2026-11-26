/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('order_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('order_id').references('id').inTable('orders').onDelete('CASCADE').notNullable();
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.string('from_state').notNullable();
    table.string('to_state').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Índices para columnas críticas de auditoría
  await knex.schema.alterTable('order_events', (table) => {
    table.index(['order_id']);
    table.index(['user_id']);
  });

  // Restricción CHECK para garantizar estados válidos en orders
  await knex.raw(
    `ALTER TABLE orders ADD CONSTRAINT orders_status_check
     CHECK (status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'))`,
  );
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check');
  await knex.schema.dropTableIfExists('order_events');
}
