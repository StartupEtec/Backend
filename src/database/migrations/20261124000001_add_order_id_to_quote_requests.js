export async function up(knex) {
  await knex.schema.alterTable('quote_requests', (table) => {
    table.uuid('order_id').references('id').inTable('orders').onDelete('SET NULL');
    table.index(['order_id']);
  });
}

export async function down(knex) {
  await knex.schema.alterTable('quote_requests', (table) => {
    table.dropIndex(['order_id']);
    table.dropColumn('order_id');
  });
}
