/**
 * Stores device tokens for push notifications (frontend issue #31).
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('user_devices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('token', 1024).notNullable();
    table.string('platform', 20).notNullable().defaultTo('unknown'); // ios, android, web, unknown
    table.string('device_name', 255).nullable();
    table.timestamp('last_used_at').defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.unique(['user_id', 'token']);
    table.index(['user_id']);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('user_devices');
}
