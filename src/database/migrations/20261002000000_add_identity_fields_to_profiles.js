/**
 * Habilita el flujo universal "Completar Perfil".
 *
 * El formulario de la app exige los mismos 4 datos de identidad para cliente y
 * trabajador: foto de perfil, foto frente del DNI, foto dorso del DNI y fecha de
 * nacimiento. Ninguno de ellos se persistía, por lo que un perfil nunca podía
 * considerarse realmente "completado".
 *
 * 1. date_of_birth, dni_front_url y dni_back_url en ambas tablas de perfiles.
 * 2. avatar_url pasa de VARCHAR(255) a TEXT: las URLs servidas por
 *    POST /api/v1/uploads pueden superar 255 caracteres al incluir firma de CDN.
 * 3. hourly_rate deja de ser NOT NULL: la tarifa se define en un flujo posterior
 *    ("elegir categoría, tarifa y certificación"), no en el alta de perfil.
 *
 * Las columnas nuevas permiten NULL a propósito: las filas preexistentes no
 * tienen esos datos y la obligatoriedad se valida en la capa Joi al crear el
 * perfil, no con constraints que romperían el backfill.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  for (const tableName of ['client_profiles', 'worker_profiles']) {
    await knex.schema.alterTable(tableName, (table) => {
      table.date('date_of_birth');
      table.text('dni_front_url');
      table.text('dni_back_url');
    });
  }

  await knex.schema.alterTable('client_profiles', (table) => {
    table.text('avatar_url').alter();
  });

  await knex.schema.alterTable('worker_profiles', (table) => {
    table.text('avatar_url').alter();
    table.decimal('hourly_rate', 10, 2).nullable().alter();
  });
}

/**
 * Revertir la migración.
 *
 * OJO: volver hourly_rate a NOT NULL falla si desde el alta de perfil se crearon
 * trabajadores sin tarifa (el caso esperado tras este cambio). Hay que completar
 * esas tarifas o eliminar esas filas antes de revertir.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('worker_profiles', (table) => {
    table.decimal('hourly_rate', 10, 2).notNullable().alter();
    table.string('avatar_url').alter();
  });

  await knex.schema.alterTable('client_profiles', (table) => {
    table.string('avatar_url').alter();
  });

  for (const tableName of ['client_profiles', 'worker_profiles']) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn('date_of_birth');
      table.dropColumn('dni_front_url');
      table.dropColumn('dni_back_url');
    });
  }
}
