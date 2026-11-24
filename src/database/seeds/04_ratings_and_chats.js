import { testClients, testWorkers } from './02_users_and_profiles.js';
import { sampleOrders } from './03_orders_and_escrow.js';
import { seedId } from '../seedId.js';

export const sampleRatings = [
  // Rating 1: Cliente 4 califica a Worker 4 (Pintura) - Orden COMPLETED c4444444
  {
    id: seedId('r-1111111'),
    order_id: sampleOrders[3].order.id,
    rater_id: testClients[3].user.id,
    ratee_id: testWorkers[3].user.id,
    rating_stars: 5,
    review_text:
      'Excelente trabajo de pintura, muy prolijo, puntual y cuidó todos los muebles. Muy recomendable.',
  },
  // Rating 2: Worker 4 califica a Cliente 4 - Orden COMPLETED c4444444
  {
    id: seedId('r-1111112'),
    order_id: sampleOrders[3].order.id,
    rater_id: testWorkers[3].user.id,
    ratee_id: testClients[3].user.id,
    rating_stars: 5,
    review_text:
      'Excelente clienta, muy amable y con todo el espacio despejado para trabajar rápido.',
  },
  // Rating 3: Cliente 5 califica a Worker 5 (Climatización) - Orden COMPLETED c5555555
  {
    id: seedId('r-2222221'),
    order_id: sampleOrders[4].order.id,
    rater_id: testClients[4].user.id,
    ratee_id: testWorkers[4].user.id,
    rating_stars: 5,
    review_text:
      'Instalación de aire acondicionado impecable, probó el equipo con instrumental adecuado y no dejó nada de polvo. 10/10.',
  },
  // Rating 4: Worker 5 califica a Cliente 5 - Orden COMPLETED c5555555
  {
    id: seedId('r-2222222'),
    order_id: sampleOrders[4].order.id,
    rater_id: testWorkers[4].user.id,
    ratee_id: testClients[4].user.id,
    rating_stars: 5,
    review_text: 'Muy cordial y puntual. Gran predisposición durante la instalación.',
  },
  // Rating 5: Cliente 1 califica a Roberto Fernández (Plomería) - Orden c1111111
  {
    id: seedId('r-3333331'),
    order_id: 'c1111111-1111-4111-8111-111111111111',
    rater_id: testClients[0].user.id,
    ratee_id: 'b1111111-1111-4111-8111-111111111111',
    rating_stars: 5,
    review_text:
      'Roberto solucionó la pérdida de agua en mi cocina muy rápido y con profesionalismo. Muy recomendado.',
  },
  // Rating 6: Cliente 2 califica a Roberto Fernández (Electricidad) - Orden c8888888
  {
    id: seedId('r-3333332'),
    order_id: 'c8888888-8888-4888-8888-888888888888',
    rater_id: testClients[1].user.id,
    ratee_id: 'b1111111-1111-4111-8111-111111111111',
    rating_stars: 4,
    review_text:
      'Buen trabajo de revisión eléctrica. Llegó a la hora acordada y cobró lo que había acordado.',
  },
  // Rating 7: Cliente 3 califica a Roberto Fernández (Plomería) - Orden c9999999
  {
    id: seedId('r-3333333'),
    order_id: 'c9999999-9999-4999-8999-999999999999',
    rater_id: testClients[2].user.id,
    ratee_id: 'b1111111-1111-4111-8111-111111111111',
    rating_stars: 3,
    review_text: 'Revisó la instalación de gas y encontró una fuga. Muy minucioso en la revisión.',
  },
  // Rating 8: Cliente 5 califica a Roberto Fernández (Gasista) - Orden c1010101
  {
    id: seedId('r-3333334'),
    order_id: 'c1010101-1010-4010-8010-101010101010',
    rater_id: testClients[4].user.id,
    ratee_id: 'b1111111-1111-4111-8111-111111111111',
    rating_stars: 5,
    review_text:
      'Instaló un bomba de agua nueva. Trabajó todo el día y dejó todo limpio. Excelente.',
  },
];

export const sampleChats = [
  // Chat entre Cliente 4 y Worker 4 vinculado a la orden de Pintura
  {
    chat: {
      id: seedId('chat-1111'),
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
        id: seedId('m-1111111'),
        sender_id: testClients[3].user.id,
        content: '¡Hola Martín! ¿A qué hora calculás que podés pasar a ver los colores de pintura?',
        message_type: 'TEXT',
        created_at: '2026-08-24T09:00:00.000Z',
      },
      {
        id: seedId('m-1111112'),
        sender_id: testWorkers[3].user.id,
        content: '¡Hola Sofía! Paso a las 14hs con el muestrario completo de colores.',
        message_type: 'TEXT',
        created_at: '2026-08-24T09:15:00.000Z',
      },
      {
        id: seedId('m-1111113'),
        sender_id: testClients[3].user.id,
        content: '¡Perfecto! El trabajo quedó increíble, ya confirmé la finalización del servicio.',
        message_type: 'TEXT',
        created_at: '2026-08-25T16:05:00.000Z',
      },
    ],
  },
  // Chat 2: Cliente 2 (María Eugenia) ↔ Worker 2 (Diego Álvarez - Electricidad) - Orden c2222222
  {
    chat: {
      id: seedId('chat-2222'),
      user_id_1: 'a2222222-2222-4222-8222-222222222222',
      user_id_2: 'b2222222-2222-4222-8222-222222222222',
      order_id: 'c2222222-2222-4222-8222-222222222222',
      last_message_at: '2026-09-07T10:30:00.000Z',
    },
    participants: [
      { user_id: 'a2222222-2222-4222-8222-222222222222', is_favorite: true, is_archived: false },
      { user_id: 'b2222222-2222-4222-8222-222222222222', is_favorite: false, is_archived: false },
    ],
    messages: [
      {
        id: seedId('m-2222221'),
        sender_id: 'a2222222-2222-4222-8222-222222222222',
        content: 'Hola Diego, ¿cuándo podrías pasar a revisar el tablero eléctrico?',
        message_type: 'TEXT',
        created_at: '2026-09-06T14:00:00.000Z',
      },
      {
        id: seedId('m-2222222'),
        sender_id: 'b2222222-2222-4222-8222-222222222222',
        content: 'Hola María. Puedo pasar mañana a las 10 de la mañana. ¿Te sirve?',
        message_type: 'TEXT',
        created_at: '2026-09-06T14:05:00.000Z',
      },
      {
        id: seedId('m-2222223'),
        sender_id: 'a2222222-2222-4222-8222-222222222222',
        content: 'Sí, perfecto. Estaré en casa.',
        message_type: 'TEXT',
        created_at: '2026-09-06T14:10:00.000Z',
      },
    ],
  },
  // Chat 3: Cliente 2 (María Eugenia) ↔ Roberto Fernández (Plomería) - Orden c8888888
  {
    chat: {
      id: seedId('chat-8888'),
      user_id_1: 'a2222222-2222-4222-8222-222222222222',
      user_id_2: 'b1111111-1111-4111-8111-111111111111',
      order_id: 'c8888888-8888-4888-8888-888888888888',
      last_message_at: '2026-09-06T16:45:00.000Z',
    },
    participants: [
      { user_id: 'a2222222-2222-4222-8222-222222222222', is_favorite: false, is_archived: false },
      { user_id: 'b1111111-1111-4111-8111-111111111111', is_favorite: false, is_archived: false },
    ],
    messages: [
      {
        id: seedId('m-8888221'),
        sender_id: 'a2222222-2222-4222-8222-222222222222',
        content: 'Hola Roberto, necesito revisar una fuga de gas en la cocina.',
        message_type: 'TEXT',
        created_at: '2026-09-06T15:00:00.000Z',
      },
      {
        id: seedId('m-8888222'),
        sender_id: 'b1111111-1111-4111-8111-111111111111',
        content: 'Hola María. Puedo pasar este viernes por la tarde. ¿Te funciona?',
        message_type: 'TEXT',
        created_at: '2026-09-06T15:05:00.000Z',
      },
      {
        id: seedId('m-8888223'),
        sender_id: 'a2222222-2222-4222-8222-222222222222',
        content: 'Sí, viernes a las 17hs está bien. Gracias.',
        message_type: 'TEXT',
        created_at: '2026-09-06T15:10:00.000Z',
      },
    ],
  },
  // Chat 4: Cliente 2 (María Eugenia) ↔ Laura Benítez (Limpieza) - Orden c2222223
  {
    chat: {
      id: seedId('chat-3333'),
      user_id_1: 'a2222222-2222-4222-8222-222222222222',
      user_id_2: 'b3333333-3333-4333-8333-333333333333',
      order_id: 'c2222223-2222-4222-8222-222222222223',
      last_message_at: '2026-09-09T11:45:00.000Z',
    },
    participants: [
      { user_id: 'a2222222-2222-4222-8222-222222222222', is_favorite: false, is_archived: false },
      { user_id: 'b3333333-3333-4333-8333-333333333333', is_favorite: false, is_archived: false },
    ],
    messages: [
      {
        id: seedId('m-3333221'),
        sender_id: 'a2222222-2222-4222-8222-222222222222',
        content: 'Hola Laura, ¿podrías hacer una limpieza profunda este fin de semana?',
        message_type: 'TEXT',
        created_at: '2026-09-09T10:00:00.000Z',
      },
      {
        id: seedId('m-3333222'),
        sender_id: 'b3333333-3333-4333-8333-333333333333',
        content: 'Hola María. Sí, tengo disponible el sábado por la mañana. ¿Te sirve?',
        message_type: 'TEXT',
        created_at: '2026-09-09T10:05:00.000Z',
      },
      {
        id: seedId('m-3333223'),
        sender_id: 'a2222222-2222-4222-8222-222222222222',
        content: 'Perfecto, sábado a las 9hs. Gracias Laura.',
        message_type: 'TEXT',
        created_at: '2026-09-09T10:10:00.000Z',
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
    testClients[0].user.id, // Cliente 1 - calificó a Roberto Fernández
    testClients[1].user.id, // Cliente 2 - calificó a Roberto Fernández
    testClients[2].user.id, // Cliente 3 - calificó a Roberto Fernández
    testClients[3].user.id,
    testClients[4].user.id, // Cliente 5 - calificó a Roberto Fernández
    testWorkers[0].user.id, // Roberto Fernández - recibió calificaciones
    testWorkers[3].user.id,
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
