import bcrypt from 'bcrypt';
import { encrypt } from '../../utils/encryption.js';

// Password hasheado para todos los usuarios de prueba: 'test123!'
const TEST_PASSWORD_HASH = bcrypt.hashSync('test123!', 10);

// --- 5 Clientes de Test ---
export const testClients = [
  {
    user: {
      id: 'a1111111-1111-4111-8111-111111111111',
      email: 'cliente1@test.com',
      phone: '+5491144441111',
      password_hash: TEST_PASSWORD_HASH,
      verified_email: true,
      verified_phone: true,
      is_verified: true,
      active: true,
      current_role: 'client',
    },
    profile: {
      id: 'cp111111-1111-4111-8111-111111111111',
      full_name: 'Juan Carlos Pérez',
      avatar_url:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
      bio: 'Profesional independiente que busca servicios de mantenimiento para el hogar.',
      preferences: JSON.stringify({
        notifications: true,
        language: 'es',
        preferred_time: 'morning',
      }),
      average_rating: 5.0,
    },
    location: {
      id: 'loc11111-1111-4111-8111-111111111111',
      address: 'Av. Santa Fe 3200, Palermo, CABA',
      latitude: -34.5885,
      longitude: -58.411,
    },
    paymentMethods: [
      {
        id: 'pm111111-1111-4111-8111-111111111111',
        card_number_masked: '**** **** **** 4242',
        card_brand: 'Visa',
        exp_month: 12,
        exp_year: 2030,
        cardholder_name: 'Juan Carlos Pérez',
        encrypted_card_number: encrypt('4242424242424242'),
        is_primary: true,
      },
    ],
  },
  {
    user: {
      id: 'a2222222-2222-4222-8222-222222222222',
      email: 'cliente2@test.com',
      phone: '+5491144442222',
      password_hash: TEST_PASSWORD_HASH,
      verified_email: true,
      verified_phone: true,
      is_verified: true,
      active: true,
      current_role: 'client',
    },
    profile: {
      id: 'cp222222-2222-4222-8222-222222222222',
      full_name: 'María Eugenia González',
      avatar_url:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
      bio: 'Arquitecta interesada en reformas y mantenimiento de propiedades.',
      preferences: JSON.stringify({
        notifications: true,
        language: 'es',
        preferred_time: 'afternoon',
      }),
      average_rating: 5.0,
    },
    location: {
      id: 'loc22222-2222-4222-8222-222222222222',
      address: 'Av. Cabildo 2100, Belgrano, CABA',
      latitude: -34.562,
      longitude: -58.456,
    },
    paymentMethods: [
      {
        id: 'pm222222-2222-4222-8222-222222222222',
        card_number_masked: '**** **** **** 5555',
        card_brand: 'Mastercard',
        exp_month: 10,
        exp_year: 2029,
        cardholder_name: 'María E González',
        encrypted_card_number: encrypt('5555555555555555'),
        is_primary: true,
      },
    ],
  },
  {
    user: {
      id: 'a3333333-3333-4333-8333-333333333333',
      email: 'cliente3@test.com',
      phone: '+5491144443333',
      password_hash: TEST_PASSWORD_HASH,
      verified_email: true,
      verified_phone: true,
      is_verified: true,
      active: true,
      current_role: 'client',
    },
    profile: {
      id: 'cp333333-3333-4333-8333-333333333333',
      full_name: 'Lucas Rodríguez',
      avatar_url:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      bio: 'Comerciante en Caballito. Necesito servicios rápidos para oficina y hogar.',
      preferences: JSON.stringify({ notifications: true, language: 'es' }),
      average_rating: 4.8,
    },
    location: {
      id: 'loc33333-3333-4333-8333-333333333333',
      address: 'Av. Rivadavia 5400, Caballito, CABA',
      latitude: -34.618,
      longitude: -58.441,
    },
    paymentMethods: [
      {
        id: 'pm333333-3333-4333-8333-333333333333',
        card_number_masked: '**** **** **** 1234',
        card_brand: 'Visa',
        exp_month: 8,
        exp_year: 2031,
        cardholder_name: 'Lucas Rodríguez',
        encrypted_card_number: encrypt('4000123456781234'),
        is_primary: true,
      },
    ],
  },
  {
    user: {
      id: 'a4444444-4444-4444-8444-444444444444',
      email: 'cliente4@test.com',
      phone: '+5491144444444',
      password_hash: TEST_PASSWORD_HASH,
      verified_email: true,
      verified_phone: true,
      is_verified: true,
      active: true,
      current_role: 'client',
    },
    profile: {
      id: 'cp444444-4444-4444-8444-444444444444',
      full_name: 'Sofía Martínez',
      avatar_url:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      bio: 'Diseñadora gráfica. Me interesa encontrar profesionales confiables para pintura y decoración.',
      preferences: JSON.stringify({ notifications: true, language: 'es' }),
      average_rating: 5.0,
    },
    location: {
      id: 'loc44444-4444-4444-8444-444444444444',
      address: 'Av. Callao 1400, Recoleta, CABA',
      latitude: -34.593,
      longitude: -58.391,
    },
    paymentMethods: [
      {
        id: 'pm444444-4444-4444-8444-444444444444',
        card_number_masked: '**** **** **** 8888',
        card_brand: 'Visa',
        exp_month: 11,
        exp_year: 2028,
        cardholder_name: 'Sofía Martínez',
        encrypted_card_number: encrypt('4111111111118888'),
        is_primary: true,
      },
    ],
  },
  {
    user: {
      id: 'a5555555-5555-4555-8555-555555555555',
      email: 'cliente5@test.com',
      phone: '+5491144445555',
      password_hash: TEST_PASSWORD_HASH,
      verified_email: true,
      verified_phone: true,
      is_verified: true,
      active: true,
      current_role: 'client',
    },
    profile: {
      id: 'cp555555-5555-4555-8555-555555555555',
      full_name: 'Carlos Alberto Gómez',
      avatar_url:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
      bio: 'Docente universitario. Busco técnicos de climatización e instalaciones eléctricas.',
      preferences: JSON.stringify({ notifications: true, language: 'es' }),
      average_rating: 4.9,
    },
    location: {
      id: 'loc55555-5555-4555-8555-555555555555',
      address: 'Av. Triunvirato 4500, Villa Urquiza, CABA',
      latitude: -34.577,
      longitude: -58.489,
    },
    paymentMethods: [
      {
        id: 'pm555555-5555-4555-8555-555555555555',
        card_number_masked: '**** **** **** 7777',
        card_brand: 'Mastercard',
        exp_month: 5,
        exp_year: 2030,
        cardholder_name: 'Carlos A Gómez',
        encrypted_card_number: encrypt('5200000000007777'),
        is_primary: true,
      },
    ],
  },
];

// --- 5 Trabajadores de Test ---
export const testWorkers = [
  {
    user: {
      id: 'b1111111-1111-4111-8111-111111111111',
      email: 'worker1@test.com',
      phone: '+5491155551111',
      password_hash: TEST_PASSWORD_HASH,
      verified_email: true,
      verified_phone: true,
      is_verified: true,
      active: true,
      current_role: 'worker',
    },
    clientProfile: {
      id: 'cpw11111-1111-4111-8111-111111111111',
      full_name: 'Roberto Fernández',
      avatar_url:
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80',
      bio: 'Plomero y gasista matriculado con amplia trayectoria.',
      average_rating: 5.0,
    },
    workerProfile: {
      id: 'wp111111-1111-4111-8111-111111111111',
      full_name: 'Roberto Fernández',
      avatar_url:
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80',
      bio: 'Especialista en plomería integral, destapaciones cloacales, bombas de agua y gas con 15 años de experiencia.',
      category_id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f002', // Plomería
      hourly_rate: 8500.0,
      availability_status: 'AVAILABLE',
      certification_status: 'APPROVED',
      average_rating: 5.0,
    },
    location: {
      id: 'locw1111-1111-4111-8111-111111111111',
      address: 'Av. Corrientes 4800, Villa Crespo, CABA',
      latitude: -34.601,
      longitude: -58.435,
    },
    certifications: [
      {
        id: 'cert1111-1111-4111-8111-111111111111',
        document_type: 'PROFESSIONAL_LICENSE',
        document_url: 'https://cdn.startup.com/certs/worker1_gas_license.pdf',
        verification_status: 'APPROVED',
      },
      {
        id: 'cert1112-1111-4111-8111-111111111111',
        document_type: 'ID_VERIFICATION',
        document_url: 'https://cdn.startup.com/certs/worker1_dni.pdf',
        verification_status: 'APPROVED',
      },
    ],
  },
  {
    user: {
      id: 'b2222222-2222-4222-8222-222222222222',
      email: 'worker2@test.com',
      phone: '+5491155552222',
      password_hash: TEST_PASSWORD_HASH,
      verified_email: true,
      verified_phone: true,
      is_verified: true,
      active: true,
      current_role: 'worker',
    },
    clientProfile: {
      id: 'cpw22222-2222-4222-8222-222222222222',
      full_name: 'Diego Álvarez',
      avatar_url:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
      bio: 'Electricista matriculado.',
      average_rating: 4.9,
    },
    workerProfile: {
      id: 'wp222222-2222-4222-8222-222222222222',
      full_name: 'Diego Álvarez',
      avatar_url:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
      bio: 'Técnico electricista matriculado. Instalaciones monofásicas y trifásicas, tableros y certificación de obra.',
      category_id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f003', // Electricidad
      hourly_rate: 9500.0,
      availability_status: 'AVAILABLE',
      certification_status: 'APPROVED',
      average_rating: 4.9,
    },
    location: {
      id: 'locw2222-2222-4222-8222-222222222222',
      address: 'Av. Juramento 2800, Belgrano, CABA',
      latitude: -34.5635,
      longitude: -58.461,
    },
    certifications: [
      {
        id: 'cert2221-2222-4222-8222-222222222222',
        document_type: 'PROFESSIONAL_LICENSE',
        document_url: 'https://cdn.startup.com/certs/worker2_copime.pdf',
        verification_status: 'APPROVED',
      },
      {
        id: 'cert2222-2222-4222-8222-222222222222',
        document_type: 'ID_VERIFICATION',
        document_url: 'https://cdn.startup.com/certs/worker2_dni.pdf',
        verification_status: 'APPROVED',
      },
    ],
  },
  {
    user: {
      id: 'b3333333-3333-4333-8333-333333333333',
      email: 'worker3@test.com',
      phone: '+5491155553333',
      password_hash: TEST_PASSWORD_HASH,
      verified_email: true,
      verified_phone: true,
      is_verified: true,
      active: true,
      current_role: 'worker',
    },
    clientProfile: {
      id: 'cpw33333-3333-4333-8333-333333333333',
      full_name: 'Laura Benítez',
      avatar_url:
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
      bio: 'Especialista en limpieza y desinfección integral.',
      average_rating: 5.0,
    },
    workerProfile: {
      id: 'wp333333-3333-4333-8333-333333333333',
      full_name: 'Laura Benítez',
      avatar_url:
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
      bio: 'Servicio profesional de limpieza profunda, mantenimiento de oficinas y fin de obra con productos biodegradables.',
      category_id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f001', // Limpieza
      hourly_rate: 6500.0,
      availability_status: 'AVAILABLE',
      certification_status: 'APPROVED',
      average_rating: 5.0,
    },
    location: {
      id: 'locw3333-3333-4333-8333-333333333333',
      address: 'Av. Las Heras 2300, Recoleta, CABA',
      latitude: -34.589,
      longitude: -58.397,
    },
    certifications: [
      {
        id: 'cert3331-3333-4333-8333-333333333333',
        document_type: 'BACKGROUND_CHECK',
        document_url: 'https://cdn.startup.com/certs/worker3_antecedentes.pdf',
        verification_status: 'APPROVED',
      },
      {
        id: 'cert3332-3333-4333-8333-333333333333',
        document_type: 'ID_VERIFICATION',
        document_url: 'https://cdn.startup.com/certs/worker3_dni.pdf',
        verification_status: 'APPROVED',
      },
    ],
  },
  {
    user: {
      id: 'b4444444-4444-4444-8444-444444444444',
      email: 'worker4@test.com',
      phone: '+5491155554444',
      password_hash: TEST_PASSWORD_HASH,
      verified_email: true,
      verified_phone: true,
      is_verified: true,
      active: true,
      current_role: 'worker',
    },
    clientProfile: {
      id: 'cpw44444-4444-4444-8444-444444444444',
      full_name: 'Martín Díaz',
      avatar_url:
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
      bio: 'Pintor profesional de obra y departamentos.',
      average_rating: 4.8,
    },
    workerProfile: {
      id: 'wp444444-4444-4444-8444-444444444444',
      full_name: 'Martín Díaz',
      avatar_url:
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
      bio: 'Pintor profesional de interiores y exteriores. Tratamiento de humedad, enduido y colocación de molduras.',
      category_id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f005', // Pintura
      hourly_rate: 7500.0,
      availability_status: 'AVAILABLE',
      certification_status: 'APPROVED',
      average_rating: 4.8,
    },
    location: {
      id: 'locw4444-4444-4444-8444-444444444444',
      address: 'Av. San Martín 2900, Villa del Parque, CABA',
      latitude: -34.604,
      longitude: -58.482,
    },
    certifications: [
      {
        id: 'cert4441-4444-4444-8444-444444444444',
        document_type: 'BACKGROUND_CHECK',
        document_url: 'https://cdn.startup.com/certs/worker4_antecedentes.pdf',
        verification_status: 'APPROVED',
      },
      {
        id: 'cert4442-4444-4444-8444-444444444444',
        document_type: 'ID_VERIFICATION',
        document_url: 'https://cdn.startup.com/certs/worker4_dni.pdf',
        verification_status: 'APPROVED',
      },
    ],
  },
  {
    user: {
      id: 'b5555555-5555-4555-8555-555555555555',
      email: 'worker5@test.com',
      phone: '+5491155555555',
      password_hash: TEST_PASSWORD_HASH,
      verified_email: true,
      verified_phone: true,
      is_verified: true,
      active: true,
      current_role: 'worker',
    },
    clientProfile: {
      id: 'cpw55555-5555-4555-8555-555555555555',
      full_name: 'Esteban Rossi',
      avatar_url:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
      bio: 'Técnico en refrigeración y climatización.',
      average_rating: 5.0,
    },
    workerProfile: {
      id: 'wp555555-5555-4555-8555-555555555555',
      full_name: 'Esteban Rossi',
      avatar_url:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
      bio: 'Instalación y service de equipos de aire acondicionado split e inverter, recarga de gas y mantenimiento integral.',
      category_id: 'd9b936d5-a3d5-45d6-b4d6-a4c3f5d6f007', // Climatización
      hourly_rate: 11000.0,
      availability_status: 'AVAILABLE',
      certification_status: 'APPROVED',
      average_rating: 5.0,
    },
    location: {
      id: 'locw5555-5555-4555-8555-555555555555',
      address: 'Av. Monroe 3400, Coghlan, CABA',
      latitude: -34.568,
      longitude: -58.472,
    },
    certifications: [
      {
        id: 'cert5551-5555-4555-8555-555555555555',
        document_type: 'PROFESSIONAL_LICENSE',
        document_url: 'https://cdn.startup.com/certs/worker5_matricula_clima.pdf',
        verification_status: 'APPROVED',
      },
      {
        id: 'cert5552-5555-4555-8555-555555555555',
        document_type: 'ID_VERIFICATION',
        document_url: 'https://cdn.startup.com/certs/worker5_dni.pdf',
        verification_status: 'APPROVED',
      },
    ],
  },
];

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  // 1. Insertar todos los usuarios
  const allUsers = [...testClients.map((c) => c.user), ...testWorkers.map((w) => w.user)];
  await knex('users').insert(allUsers);

  // 2. Insertar Ubicaciones para todos los usuarios (con PostGIS geography)
  for (const client of testClients) {
    await knex('locations').insert({
      id: client.location.id,
      user_id: client.user.id,
      address: client.location.address,
      latitude: client.location.latitude,
      longitude: client.location.longitude,
      geography: knex.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [
        client.location.longitude,
        client.location.latitude,
      ]),
      is_primary: true,
    });
  }

  for (const worker of testWorkers) {
    await knex('locations').insert({
      id: worker.location.id,
      user_id: worker.user.id,
      address: worker.location.address,
      latitude: worker.location.latitude,
      longitude: worker.location.longitude,
      geography: knex.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [
        worker.location.longitude,
        worker.location.latitude,
      ]),
      is_primary: true,
    });
  }

  // 3. Insertar Perfiles de Clientes
  for (const client of testClients) {
    await knex('client_profiles').insert({
      id: client.profile.id,
      user_id: client.user.id,
      full_name: client.profile.full_name,
      avatar_url: client.profile.avatar_url,
      bio: client.profile.bio,
      default_location_id: client.location.id,
      preferences: client.profile.preferences,
      average_rating: client.profile.average_rating,
    });
  }

  // Los trabajadores también cuentan con perfil de cliente (Rol Dual)
  for (const worker of testWorkers) {
    await knex('client_profiles').insert({
      id: worker.clientProfile.id,
      user_id: worker.user.id,
      full_name: worker.clientProfile.full_name,
      avatar_url: worker.clientProfile.avatar_url,
      bio: worker.clientProfile.bio,
      default_location_id: worker.location.id,
      average_rating: worker.clientProfile.average_rating,
    });
  }

  // 4. Insertar Perfiles de Trabajador
  for (const worker of testWorkers) {
    await knex('worker_profiles').insert({
      id: worker.workerProfile.id,
      user_id: worker.user.id,
      full_name: worker.workerProfile.full_name,
      avatar_url: worker.workerProfile.avatar_url,
      bio: worker.workerProfile.bio,
      category_id: worker.workerProfile.category_id,
      hourly_rate: worker.workerProfile.hourly_rate,
      availability_status: worker.workerProfile.availability_status,
      certification_status: worker.workerProfile.certification_status,
      average_rating: worker.workerProfile.average_rating,
    });

    // Certificaciones
    for (const cert of worker.certifications) {
      await knex('certifications').insert({
        id: cert.id,
        worker_id: worker.workerProfile.id,
        document_type: cert.document_type,
        document_url: cert.document_url,
        verification_status: cert.verification_status,
        approved_at: knex.fn.now(),
      });
    }

    // Disponibilidad semanal de Lunes a Viernes (1 a 5) de 09:00 a 18:00
    for (let day = 1; day <= 5; day++) {
      await knex('worker_availability').insert({
        worker_id: worker.workerProfile.id,
        day_of_week: day,
        start_time: '09:00:00',
        end_time: '18:00:00',
      });
    }
  }

  // 5. Insertar Métodos de Pago para Clientes
  for (const client of testClients) {
    for (const pm of client.paymentMethods) {
      await knex('payment_methods').insert({
        id: pm.id,
        user_id: client.user.id,
        card_number_masked: pm.card_number_masked,
        card_brand: pm.card_brand,
        exp_month: pm.exp_month,
        exp_year: pm.exp_year,
        cardholder_name: pm.cardholder_name,
        encrypted_card_number: pm.encrypted_card_number,
        is_primary: pm.is_primary,
      });
    }
  }

  // 6. Insertar Wallets y Preferencias de Notificaciones para todos los usuarios
  for (const user of allUsers) {
    await knex('user_wallets').insert({
      user_id: user.id,
      current_balance: 0.0,
      escrowed_balance: 0.0,
    });

    await knex('notification_preferences').insert({
      user_id: user.id,
      push_enabled: true,
      email_enabled: true,
      sms_enabled: true,
      dnd_enabled: false,
    });
  }
}
