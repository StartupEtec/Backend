/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Motivo opcional registrado cuando el cliente rechaza una cotización (renegociación).
  await knex.schema.alterTable('quotes', (table) => {
    table.text('rejection_reason');
  });

  // Restringir el dominio de estados de la máquina de estados de cotizaciones.
  await knex.raw(
    `ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
     CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'))`,
  );

  // Una sola transacción (pago/escrow) por orden: evita iniciar el pago dos veces.
  await knex.schema.alterTable('transactions', (table) => {
    table.unique(['order_id'], { indexName: 'transactions_order_id_unique' });
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('transactions', (table) => {
    table.dropUnique(['order_id'], 'transactions_order_id_unique');
  });
  await knex.raw('ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check');
  await knex.schema.alterTable('quotes', (table) => {
    table.dropColumn('rejection_reason');
  });
}
