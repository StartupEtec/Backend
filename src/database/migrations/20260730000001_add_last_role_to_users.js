export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table
      .string('last_role')
      .nullable()
      .comment('Último rol usado antes del cambio actual (client o worker)');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('last_role');
  });
}
