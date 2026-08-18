/**
 * Agrega restricciones a la tabla ratings y columnas average_rating a los perfiles.
 *
 * 1. UNIQUE constraint en (order_id, rater_id) para prevenir múltiples ratings
 *    por el mismo usuario en la misma orden.
 * 2. CHECK constraint en rating_stars (1-5).
 * 3. Columna average_rating en worker_profiles y client_profiles.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Unique constraint: un solo rating por usuario por orden
  await knex.raw(`
    ALTER TABLE ratings ADD CONSTRAINT ratings_order_rater_unique
    UNIQUE (order_id, rater_id)
  `);

  // 2. Check constraint: rating_stars entre 1 y 5
  await knex.raw(`
    ALTER TABLE ratings ADD CONSTRAINT ratings_stars_check
    CHECK (rating_stars >= 1 AND rating_stars <= 5)
  `);

  // 3. Columna average_rating en perfiles
  await knex.schema.alterTable('worker_profiles', (table) => {
    table.decimal('average_rating', 3, 1);
  });

  await knex.schema.alterTable('client_profiles', (table) => {
    table.decimal('average_rating', 3, 1);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('client_profiles', (table) => {
    table.dropColumn('average_rating');
  });

  await knex.schema.alterTable('worker_profiles', (table) => {
    table.dropColumn('average_rating');
  });

  await knex.raw('ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_stars_check');
  await knex.raw('ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_order_rater_unique');
}
