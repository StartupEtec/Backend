/**
 * Portfolio/gallery items for worker public profile (frontend issue #14).
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('worker_portfolio_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('worker_id')
      .notNullable()
      .references('id')
      .inTable('worker_profiles')
      .onDelete('CASCADE');
    table.string('image_url', 2048).notNullable();
    table.string('title', 255).nullable();
    table.text('description').nullable();
    table.timestamps(true, true);

    table.index(['worker_id']);
    table.index(['created_at']);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('worker_portfolio_items');
}
