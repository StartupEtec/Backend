import db from '../db.js';
import logger from '../../utils/logger.js';

/**
 * Limpia todas las tablas de la base de datos en orden estricto de dependencias
 * para evitar violaciones de foreign keys y dejar la BD en estado limpio.
 *
 * @param {import('knex').Knex} knexInstance
 * @returns {Promise<void>}
 */
export async function clearDatabase(knexInstance = db) {
  logger.info('[SEED] Iniciando limpieza completa de la base de datos...');

  await knexInstance.transaction(async (trx) => {
    // 1. Tablas dependientes de órdenes, transacciones y chats
    await trx('disputes').del();
    await trx('ratings').del();
    await trx('transaction_logs').del();
    await trx('transactions').del();
    await trx('messages').del();
    await trx('chat_participants').del();
    await trx('chats').del();
    await trx('quotes').del();
    await trx('order_events').del();
    await trx('orders').del();

    // 2. Tablas asociadas a usuarios y perfiles
    await trx('payment_methods').del();
    await trx('certifications').del();
    await trx('worker_availability').del();

    // Romper referencia circular temporal antes de borrar ubicaciones
    await trx('client_profiles').update({ default_location_id: null });

    await trx('worker_profiles').del();
    await trx('client_profiles').del();
    await trx('locations').del();
    await trx('user_wallets').del();
    await trx('notifications').del();
    await trx('notification_preferences').del();
    await trx('refresh_tokens').del();
    await trx('pending_user_changes').del();

    // 3. Tablas raíz
    await trx('users').del();
    await trx('categories').del();
  });

  logger.info('[SEED] Limpieza de base de datos finalizada correctamente.');
}

// Ejecución directa por CLI: node src/database/seeds/clear.js
if (process.argv[1] && process.argv[1].endsWith('clear.js')) {
  clearDatabase(db)
    .then(() => {
      console.log('✅ Base de datos limpiada exitosamente.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Error al limpiar la base de datos:', err);
      process.exit(1);
    });
}

export default clearDatabase;
