export function up(knex) {
  return knex.schema.alterTable('certifications', (table) => {
    table.text('rejected_reason');
  });
}

export function down(knex) {
  return knex.schema.alterTable('certifications', (table) => {
    table.dropColumn('rejected_reason');
  });
}
