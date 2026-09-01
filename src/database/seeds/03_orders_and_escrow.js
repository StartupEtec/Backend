import { testClients, testWorkers } from './02_users_and_profiles.js';

export const sampleOrders = [
  // 1. Orden PENDING (Cliente 1 solicita servicio a Worker 1 - Plomería)
  {
    order: {
      id: 'c1111111-1111-4111-8111-111111111111',
      client_id: testClients[0].profile.id,
      worker_id: testWorkers[0].workerProfile.id,
      category_id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f002', // Plomería
      location_id: testClients[0].location.id,
      description: 'Reparación de pérdida de agua en bajo mesada y cambio de flexible de cocina.',
      status: 'PENDING',
    },
    quote: {
      id: 'q1111111-1111-4111-8111-111111111111',
      proposed_price: 15000.0,
      proposed_date: '2026-09-05',
      proposed_time: '10:00:00',
      status: 'PENDING',
    },
    events: [{ from_state: null, to_state: 'PENDING', user_id: testClients[0].user.id }],
  },
  // 2. Orden ACCEPTED con pago en ESCROW (Cliente 2 a Worker 2 - Electricidad)
  {
    order: {
      id: 'c2222222-2222-4222-8222-222222222222',
      client_id: testClients[1].profile.id,
      worker_id: testWorkers[1].workerProfile.id,
      category_id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f003', // Electricidad
      location_id: testClients[1].location.id,
      description: 'Instalación de disyuntor diferencial y 4 llaves térmicas en tablero principal.',
      status: 'ACCEPTED',
    },
    quote: {
      id: 'q2222222-2222-4222-8222-222222222222',
      proposed_price: 25000.0,
      proposed_date: '2026-09-06',
      proposed_time: '14:30:00',
      status: 'ACCEPTED',
    },
    transaction: {
      id: 'tx222222-2222-4222-8222-222222222222',
      payer_id: testClients[1].user.id,
      receiver_id: testWorkers[1].user.id,
      amount: 25000.0,
      status: 'ESCROWED',
      payment_method_id: testClients[1].paymentMethods[0].id,
    },
    events: [
      { from_state: null, to_state: 'PENDING', user_id: testClients[1].user.id },
      { from_state: 'PENDING', to_state: 'ACCEPTED', user_id: testClients[1].user.id },
    ],
  },
  // 3. Orden IN_PROGRESS con pago en ESCROW (Cliente 3 a Worker 3 - Limpieza)
  {
    order: {
      id: 'c3333333-3333-4333-8333-333333333333',
      client_id: testClients[2].profile.id,
      worker_id: testWorkers[2].workerProfile.id,
      category_id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f001', // Limpieza
      location_id: testClients[2].location.id,
      description: 'Limpieza profunda integral de departamento 3 ambientes con balcón.',
      status: 'IN_PROGRESS',
    },
    quote: {
      id: 'q3333333-3333-4333-8333-333333333333',
      proposed_price: 32000.0,
      proposed_date: '2026-09-04',
      proposed_time: '09:00:00',
      status: 'ACCEPTED',
    },
    transaction: {
      id: 'tx333333-3333-4333-8333-333333333333',
      payer_id: testClients[2].user.id,
      receiver_id: testWorkers[2].user.id,
      amount: 32000.0,
      status: 'ESCROWED',
      payment_method_id: testClients[2].paymentMethods[0].id,
    },
    events: [
      { from_state: null, to_state: 'PENDING', user_id: testClients[2].user.id },
      { from_state: 'PENDING', to_state: 'ACCEPTED', user_id: testClients[2].user.id },
      { from_state: 'ACCEPTED', to_state: 'IN_PROGRESS', user_id: testWorkers[2].user.id },
    ],
  },
  // 4. Orden COMPLETED (Cliente 4 a Worker 4 - Pintura)
  {
    order: {
      id: 'c4444444-4444-4444-8444-444444444444',
      client_id: testClients[3].profile.id,
      worker_id: testWorkers[3].workerProfile.id,
      category_id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f005', // Pintura
      location_id: testClients[3].location.id,
      description: 'Pintura de living-comedor (30 m2) con dos manos de látex lavable satinado.',
      status: 'COMPLETED',
      client_confirmed: true,
      client_confirmed_at: '2026-08-25T16:00:00.000Z',
      client_confirmed_by: testClients[3].user.id,
      worker_confirmed: true,
      worker_confirmed_at: '2026-08-25T15:30:00.000Z',
      worker_confirmed_by: testWorkers[3].user.id,
    },
    quote: {
      id: 'q4444444-4444-4444-8444-444444444444',
      proposed_price: 65000.0,
      proposed_date: '2026-08-24',
      proposed_time: '08:30:00',
      status: 'ACCEPTED',
    },
    transaction: {
      id: 'tx444444-4444-4444-8444-444444444444',
      payer_id: testClients[3].user.id,
      receiver_id: testWorkers[3].user.id,
      amount: 65000.0,
      status: 'COMPLETED',
      payment_method_id: testClients[3].paymentMethods[0].id,
    },
    events: [
      { from_state: null, to_state: 'PENDING', user_id: testClients[3].user.id },
      { from_state: 'PENDING', to_state: 'ACCEPTED', user_id: testClients[3].user.id },
      { from_state: 'ACCEPTED', to_state: 'IN_PROGRESS', user_id: testWorkers[3].user.id },
      { from_state: 'IN_PROGRESS', to_state: 'COMPLETED', user_id: testClients[3].user.id },
    ],
  },
  // 5. Orden COMPLETED (Cliente 5 a Worker 5 - Climatización)
  {
    order: {
      id: 'c5555555-5555-4555-8555-555555555555',
      client_id: testClients[4].profile.id,
      worker_id: testWorkers[4].workerProfile.id,
      category_id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f007', // Climatización
      location_id: testClients[4].location.id,
      description:
        'Instalación completa de aire acondicionado split 3500 frigorías con kit de caños.',
      status: 'COMPLETED',
      client_confirmed: true,
      client_confirmed_at: '2026-08-28T18:00:00.000Z',
      client_confirmed_by: testClients[4].user.id,
      worker_confirmed: true,
      worker_confirmed_at: '2026-08-28T17:45:00.000Z',
      worker_confirmed_by: testWorkers[4].user.id,
    },
    quote: {
      id: 'q5555555-5555-4555-8555-555555555555',
      proposed_price: 85000.0,
      proposed_date: '2026-08-28',
      proposed_time: '13:00:00',
      status: 'ACCEPTED',
    },
    transaction: {
      id: 'tx555555-5555-4555-8555-555555555555',
      payer_id: testClients[4].user.id,
      receiver_id: testWorkers[4].user.id,
      amount: 85000.0,
      status: 'COMPLETED',
      payment_method_id: testClients[4].paymentMethods[0].id,
    },
    events: [
      { from_state: null, to_state: 'PENDING', user_id: testClients[4].user.id },
      { from_state: 'PENDING', to_state: 'ACCEPTED', user_id: testClients[4].user.id },
      { from_state: 'ACCEPTED', to_state: 'IN_PROGRESS', user_id: testWorkers[4].user.id },
      { from_state: 'IN_PROGRESS', to_state: 'COMPLETED', user_id: testClients[4].user.id },
    ],
  },
  // 6. Orden CANCELLED (Cliente 1 a Worker 2 - Electricidad)
  {
    order: {
      id: 'c6666666-6666-4666-8666-666666666666',
      client_id: testClients[0].profile.id,
      worker_id: testWorkers[1].workerProfile.id,
      category_id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f003', // Electricidad
      location_id: testClients[0].location.id,
      description: 'Revisión de cortocircuito en jardín.',
      status: 'CANCELLED',
    },
    quote: {
      id: 'q6666666-6666-4666-8666-666666666666',
      proposed_price: 18000.0,
      proposed_date: '2026-08-20',
      proposed_time: '11:00:00',
      status: 'CANCELLED',
    },
    events: [
      { from_state: null, to_state: 'PENDING', user_id: testClients[0].user.id },
      { from_state: 'PENDING', to_state: 'CANCELLED', user_id: testClients[0].user.id },
    ],
  },
  // 7. Orden REJECTED (Cliente 2 a Worker 4 - Pintura)
  {
    order: {
      id: 'c7777777-7777-4777-8777-777777777777',
      client_id: testClients[1].profile.id,
      worker_id: testWorkers[3].workerProfile.id,
      category_id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f005', // Pintura
      location_id: testClients[1].location.id,
      description: 'Pintura exterior de fachada de edificio (3 pisos).',
      status: 'REJECTED',
    },
    quote: {
      id: 'q7777777-7777-4777-8777-777777777777',
      proposed_price: 220000.0,
      proposed_date: '2026-08-22',
      proposed_time: '09:00:00',
      status: 'REJECTED',
      rejection_reason: 'Presupuesto excede el rango solicitado por el cliente',
    },
    events: [
      { from_state: null, to_state: 'PENDING', user_id: testClients[1].user.id },
      { from_state: 'PENDING', to_state: 'REJECTED', user_id: testClients[1].user.id },
    ],
  },
];

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  for (const item of sampleOrders) {
    // 1. Insertar orden
    await knex('orders').insert({
      id: item.order.id,
      client_id: item.order.client_id,
      worker_id: item.order.worker_id,
      category_id: item.order.category_id,
      location_id: item.order.location_id,
      description: item.order.description,
      status: item.order.status,
      client_confirmed: item.order.client_confirmed || false,
      client_confirmed_at: item.order.client_confirmed_at || null,
      client_confirmed_by: item.order.client_confirmed_by || null,
      worker_confirmed: item.order.worker_confirmed || false,
      worker_confirmed_at: item.order.worker_confirmed_at || null,
      worker_confirmed_by: item.order.worker_confirmed_by || null,
    });

    // 2. Insertar cotización
    if (item.quote) {
      await knex('quotes').insert({
        id: item.quote.id,
        order_id: item.order.id,
        proposed_price: item.quote.proposed_price,
        proposed_date: item.quote.proposed_date,
        proposed_time: item.quote.proposed_time,
        status: item.quote.status,
        rejection_reason: item.quote.rejection_reason || null,
      });
    }

    // 3. Insertar eventos de orden
    if (item.events) {
      for (const ev of item.events) {
        await knex('order_events').insert({
          order_id: item.order.id,
          user_id: ev.user_id,
          from_state: ev.from_state,
          to_state: ev.to_state,
        });
      }
    }

    // 4. Insertar transacción y actualizar wallets de escrow si aplica
    if (item.transaction) {
      await knex('transactions').insert({
        id: item.transaction.id,
        order_id: item.order.id,
        payer_id: item.transaction.payer_id,
        receiver_id: item.transaction.receiver_id,
        amount: item.transaction.amount,
        status: item.transaction.status,
        payment_method_id: item.transaction.payment_method_id,
      });

      if (item.transaction.status === 'ESCROWED') {
        // Fondos retenidos en la wallet del cliente
        await knex('user_wallets')
          .where({ user_id: item.transaction.payer_id })
          .increment('escrowed_balance', item.transaction.amount);

        await knex('transaction_logs').insert({
          transaction_id: item.transaction.id,
          from_status: 'PENDING',
          to_status: 'ESCROWED',
          changed_by_id: item.transaction.payer_id,
          reason: 'Pago cargado con éxito; fondos retenidos en garantía (escrow)',
        });
      } else if (item.transaction.status === 'COMPLETED') {
        // Fondos liberados y acreditados en la wallet del trabajador
        await knex('user_wallets')
          .where({ user_id: item.transaction.receiver_id })
          .increment('current_balance', item.transaction.amount);

        await knex('transaction_logs').insert({
          transaction_id: item.transaction.id,
          from_status: 'ESCROWED',
          to_status: 'COMPLETED',
          changed_by_id: item.transaction.payer_id,
          reason: 'Servicio finalizado y confirmado por ambas partes; fondos liberados',
        });
      }
    }
  }
}
