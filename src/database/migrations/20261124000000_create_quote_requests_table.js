export async function up(knex) {
  await knex.schema.createTable('quote_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('client_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.uuid('worker_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table
      .uuid('category_id')
      .references('id')
      .inTable('categories')
      .onDelete('RESTRICT')
      .notNullable();
    table.uuid('location_id').references('id').inTable('locations').onDelete('SET NULL');
    table.text('description');
    table.decimal('budget', 10, 2);
    table.date('scheduled_date');
    table.string('status').defaultTo('PENDING').notNullable();
    table.text('rejection_reason');
    table.timestamps(true, true);

    table.index(['client_id']);
    table.index(['worker_id']);
    table.index(['status']);
    table.index(['created_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('quote_requests');
}
