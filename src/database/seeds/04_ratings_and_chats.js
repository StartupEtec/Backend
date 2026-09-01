import { testClients, testWorkers } from './02_users_and_profiles.js';
import { sampleOrders } from './03_orders_and_escrow.js';

export const sampleRatings = [
  // Rating 1: Cliente 4 califica a Worker 4 (Pintura) - Orden COMPLETED c4444444
  {
    id: 'r1111111-1111-4111-8111-111111111111',
    order_id: sampleOrders[3].order.id,
    rater_id: testClients[3].user.id,
    ratee_id: testWorkers[3].user.id,
    rating_stars: 5,
    review_text:
      'Excelente trabajo de pintura, muy prolijo, puntual y cuidó todos los muebles. Muy recomendable.',
  },
  // Rating 2: Worker 4 califica a Cliente 4 - Orden COMPLETED c4444444
  {
    id: 'r1111112-1111-4111-8111-111111111111',
    order_id: sampleOrders[3].order.id,
    rater_id: testWorkers[3].user.id,
    ratee_id: testClients[3].user.id,
    rating_stars: 5,
    review_text:
      'Excelente clienta, muy amable y con todo el espacio despejado para trabajar rápido.',
  },
  // Rating 3: Cliente 5 califica a Worker 5 (Climatización) - Orden COMPLETED c5555555
  {
    id: 'r2222221-2222-4222-8222-222222222222',
    order_id: sampleOrders[4].order.id,
    rater_id: testClients[4].user.id,
    ratee_id: testWorkers[4].user.id,
    rating_stars: 5,
    review_text:
      'Instalación de aire acondicionado impecable, probó el equipo con instrumental adecuado y no dejó nada de polvo. 10/10.',
  },
  // Rating 4: Worker 5 califica a Cliente 5 - Orden COMPLETED c5555555
  {
    id: 'r2222222-2222-4222-8222-222222222222',
    order_id: sampleOrders[4].order.id,
    rater_id: testWorkers[4].user.id,
    ratee_id: testClients[4].user.id,
    rating_stars: 5,
    review_text: 'Muy cordial y puntual. Gran predisposición durante la instalación.',
  },
];

export const sampleChats = [
  // Chat entre Cliente 4 y Worker 4 vinculado a la orden de Pintura
  {
    chat: {
      id: 'chat1111-1111-4111-8111-111111111111',
      user_id_1:
        testClients[3].user.id < testWorkers[3].user.id
          ? testClients[3].user.id
          : testWorkers[3].user.id,
      user_id_2:
        testClients[3].user.id < testWorkers[3].user.id
          ? testWorkers[3].user.id
          : testClients[3].user.id,
      order_id: sampleOrders[3].order.id,
      last_message_at: '2026-08-25T16:05:00.000Z',
    },
    participants: [
      { user_id: testClients[3].user.id, is_favorite: true, is_archived: false },
      { user_id: testWorkers[3].user.id, is_favorite: false, is_archived: false },
    ],
    messages: [
      {
        id: 'm1111111-1111-4111-8111-111111111111',
        sender_id: testClients[3].user.id,
        content: '¡Hola Martín! ¿A qué hora calculás que podés pasar a ver los colores de pintura?',
        message_type: 'TEXT',
        created_at: '2026-08-24T09:00:00.000Z',
      },
      {
        id: 'm1111112-1111-4111-8111-111111111111',
        sender_id: testWorkers[3].user.id,
        content: '¡Hola Sofía! Paso a las 14hs con el muestrario completo de colores.',
        message_type: 'TEXT',
        created_at: '2026-08-24T09:15:00.000Z',
      },
      {
        id: 'm1111113-1111-4111-8111-111111111111',
        sender_id: testClients[3].user.id,
        content: '¡Perfecto! El trabajo quedó increíble, ya confirmé la finalización del servicio.',
        message_type: 'TEXT',
        created_at: '2026-08-25T16:05:00.000Z',
      },
    ],
  },
];

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  // 1. Insertar calificaciones y reseñas de ejemplo
  for (const rating of sampleRatings) {
    await knex('ratings').insert({
      id: rating.id,
      order_id: rating.order_id,
      rater_id: rating.rater_id,
      ratee_id: rating.ratee_id,
      rating_stars: rating.rating_stars,
      review_text: rating.review_text,
    });
  }

  // 2. Recalcular promedios en perfiles
  const userIdsWithRatings = [
    testClients[3].user.id,
    testWorkers[3].user.id,
    testClients[4].user.id,
    testWorkers[4].user.id,
  ];

  for (const uid of userIdsWithRatings) {
    const avgResult = await knex('ratings')
      .where({ ratee_id: uid })
      .avg('rating_stars as avg')
      .first();

    const avg = avgResult?.avg ? Number(Number(avgResult.avg).toFixed(1)) : null;

    await knex('worker_profiles').where({ user_id: uid }).update({ average_rating: avg });
    await knex('client_profiles').where({ user_id: uid }).update({ average_rating: avg });
  }

  // 3. Insertar chats, participantes y mensajes
  for (const item of sampleChats) {
    await knex('chats').insert({
      id: item.chat.id,
      user_id_1: item.chat.user_id_1,
      user_id_2: item.chat.user_id_2,
      order_id: item.chat.order_id,
      last_message_at: item.chat.last_message_at,
    });

    for (const p of item.participants) {
      await knex('chat_participants').insert({
        chat_id: item.chat.id,
        user_id: p.user_id,
        is_favorite: p.is_favorite,
        is_archived: p.is_archived,
        last_read_at: knex.fn.now(),
      });
    }

    for (const msg of item.messages) {
      await knex('messages').insert({
        id: msg.id,
        chat_id: item.chat.id,
        sender_id: msg.sender_id,
        content: msg.content,
        message_type: msg.message_type,
        created_at: msg.created_at,
      });
    }
  }
}
