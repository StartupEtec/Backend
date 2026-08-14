/**
 * Sistema de escrow (Issue #19): retención/liberación de fondos sobre transacciones.
 *
 * 1. Extiende `transactions.status` con el estado FAILED y restringe los valores
 *    permitidos mediante CHECK (PENDING, ESCROWED, COMPLETED, REFUNDED, FAILED).
 * 2. Crea `user_wallets`: saldo disponible (`current_balance`) y fondos retenidos
 *    en escrow (`escrowed_balance`) por usuario.
 * 3. Crea `transaction_logs`: auditoría de cada cambio de estado de una transacción.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Dominio de estados de transacción + FAILED
  await knex.raw('ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check');
  await knex.raw(
    `ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
     CHECK (status IN ('PENDING', 'ESCROWED', 'COMPLETED', 'REFUNDED', 'FAILED'))`,
  );

  // 2. Wallets de usuario (saldos disponibles y retenidos en escrow)
  await knex.schema.createTable('user_wallets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .unique()
      .notNullable();
    table.decimal('current_balance', 12, 2).defaultTo(0).notNullable();
    table.decimal('escrowed_balance', 12, 2).defaultTo(0).notNullable();
    table.timestamps(true, true);

    table.index(['user_id']);
  });

  // 3. Auditoría de transacciones (cada cambio de estado se registra aquí)
  await knex.schema.createTable('transaction_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('transaction_id')
      .references('id')
      .inTable('transactions')
      .onDelete('CASCADE')
      .notNullable();
    table.string('from_status').notNullable();
    table.string('to_status').notNullable();
    table.uuid('changed_by_id').references('id').inTable('users').onDelete('SET NULL');
    table.text('reason');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['transaction_id']);
    table.index(['created_at']);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('transaction_logs');
  await knex.schema.dropTableIfExists('user_wallets');
  await knex.raw('ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check');
}
