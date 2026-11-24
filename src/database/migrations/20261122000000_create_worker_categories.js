/**
 * Migración: tabla intermedia worker_categories para soportar múltiples
 * categorías por trabajador (relación muchos a muchos).
 *
 * El campo category_id de worker_profiles se mantiene como categoría
 * principal/legacy, pero worker_categories permite asignar varias.
 */
export async function up(knex) {
  await knex.schema.createTable('worker_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('worker_profile_id')
      .references('id')
      .inTable('worker_profiles')
      .onDelete('CASCADE')
      .notNullable();
    table
      .uuid('category_id')
      .references('id')
      .inTable('categories')
      .onDelete('CASCADE')
      .notNullable();
    table.unique(['worker_profile_id', 'category_id']);
    table.timestamps(true, true);

    table.index(['worker_profile_id']);
    table.index(['category_id']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('worker_categories');
}
