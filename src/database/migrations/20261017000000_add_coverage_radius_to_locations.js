/**
 * Añade la columna `coverage_radius_km` a la tabla `locations`.
 * Representa el radio de cobertura circular en kilómetros para la ubicación de un trabajador.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('locations', (table) => {
    table.specificType('coverage_radius_km', 'NUMERIC(6,3)').nullable().defaultTo(null);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('locations', (table) => {
    table.dropColumn('coverage_radius_km');
  });
}
