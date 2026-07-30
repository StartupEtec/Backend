export async function up(knex) {
  await knex.schema.alterTable('client_profiles', (table) => {
    table
      .jsonb('preferences')
      .nullable()
      .comment('Preferencias del cliente en formato JSON (notificaciones, idioma, tema, etc.)');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('client_profiles', (table) => {
    table.dropColumn('preferences');
  });
}
