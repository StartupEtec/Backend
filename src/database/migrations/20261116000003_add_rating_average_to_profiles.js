/**
 * Adds average_rating to client_profiles and worker_profiles for rating aggregates (#24/#25).
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  const hasClientAvg = await knex.schema.hasColumn('client_profiles', 'average_rating');
  if (!hasClientAvg) {
    await knex.schema.alterTable('client_profiles', (table) => {
      table.decimal('average_rating', 3, 2).nullable();
    });
  }
  const hasWorkerAvg = await knex.schema.hasColumn('worker_profiles', 'average_rating');
  if (!hasWorkerAvg) {
    await knex.schema.alterTable('worker_profiles', (table) => {
      table.decimal('average_rating', 3, 2).nullable();
    });
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  const hasClientAvg = await knex.schema.hasColumn('client_profiles', 'average_rating');
  if (hasClientAvg) {
    await knex.schema.alterTable('client_profiles', (table) => {
      table.dropColumn('average_rating');
    });
  }
  const hasWorkerAvg = await knex.schema.hasColumn('worker_profiles', 'average_rating');
  if (hasWorkerAvg) {
    await knex.schema.alterTable('worker_profiles', (table) => {
      table.dropColumn('average_rating');
    });
  }
}
