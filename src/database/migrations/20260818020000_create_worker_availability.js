/**
 * Crea la tabla worker_availability para que los trabajadores definan
 * su disponibilidad horaria semanal (día de la semana + rango de horas).
 *
 * Restricciones:
 * - day_of_week entre 0 (Domingo) y 6 (Sábado).
 * - start_time siempre anterior a end_time.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('worker_availability', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('worker_id')
      .references('id')
      .inTable('worker_profiles')
      .onDelete('CASCADE')
      .notNullable();
    table.integer('day_of_week').notNullable(); // 0 (Domingo) a 6 (Sábado)
    table.time('start_time', { precision: 0 }).notNullable();
    table.time('end_time', { precision: 0 }).notNullable();
    table.timestamps(true, true);

    table.index(['worker_id']);
    table.index(['day_of_week']);
  });

  await knex.raw(`
    ALTER TABLE worker_availability
    ADD CONSTRAINT worker_availability_day_of_week_check
    CHECK (day_of_week BETWEEN 0 AND 6)
  `);

  await knex.raw(`
    ALTER TABLE worker_availability
    ADD CONSTRAINT worker_availability_time_range_check
    CHECK (start_time < end_time)
  `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('worker_availability');
}
