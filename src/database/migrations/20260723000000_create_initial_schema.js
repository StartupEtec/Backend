/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Habilitar la extensión de PostGIS para geolocalización
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis');

  // 1. Tabla users
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').unique().notNullable();
    table.string('phone').unique().notNullable();
    table.string('password_hash').notNullable();
    table.boolean('verified_email').defaultTo(false).notNullable();
    table.boolean('verified_phone').defaultTo(false).notNullable();
    table.boolean('active').defaultTo(true).notNullable();
    table.timestamps(true, true); // created_at, updated_at

    table.index(['created_at']);
  });

  // 2. Tabla categories
  await knex.schema.createTable('categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').unique().notNullable();
    table.text('description');
    table.string('icon_url');
    table.boolean('active').defaultTo(true).notNullable();
  });

  // 3. Tabla locations
  await knex.schema.createTable('locations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.string('address').notNullable();
    table.double('latitude').notNullable();
    table.double('longitude').notNullable();
    // Columna de tipo Geografía de PostGIS (Punto, SRID 4326)
    table.specificType('geography', 'geography(Point, 4326)').notNullable();
    table.boolean('is_primary').defaultTo(false).notNullable();
    table.timestamps(true, true);

    table.index(['user_id']);
    table.index(['created_at']);
  });

  // Crear índice espacial GIST sobre la columna geography usando Raw SQL
  await knex.raw('CREATE INDEX locations_geography_gist ON locations USING GIST (geography)');

  // 4. Tabla client_profiles
  await knex.schema.createTable('client_profiles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .unique()
      .notNullable();
    table.string('full_name').notNullable();
    table.string('avatar_url');
    table.text('bio');
    table.uuid('default_location_id').references('id').inTable('locations').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index(['user_id']);
  });

  // 5. Tabla worker_profiles
  await knex.schema.createTable('worker_profiles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .unique()
      .notNullable();
    table.string('full_name').notNullable();
    table.string('avatar_url');
    table.text('bio');
    table.uuid('category_id').references('id').inTable('categories').onDelete('SET NULL');
    table.decimal('hourly_rate', 10, 2).notNullable();
    table.string('availability_status').defaultTo('AVAILABLE').notNullable(); // AVAILABLE, BUSY, OFFLINE
    table.string('certification_status').defaultTo('PENDING').notNullable(); // PENDING, APPROVED, REJECTED
    table.timestamps(true, true);

    table.index(['user_id']);
    table.index(['category_id']);
  });

  // 6. Tabla certifications
  await knex.schema.createTable('certifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('worker_id')
      .references('id')
      .inTable('worker_profiles')
      .onDelete('CASCADE')
      .notNullable();
    table.string('document_type').notNullable(); // ID, LICENSE, CERTIFICATE, BACKGROUND_CHECK
    table.string('document_url').notNullable();
    table.string('verification_status').defaultTo('PENDING').notNullable(); // PENDING, APPROVED, REJECTED
    table.timestamp('approved_at');
    table.timestamps(true, true);

    table.index(['worker_id']);
    table.index(['verification_status']);
  });

  // 7. Tabla payment_methods
  await knex.schema.createTable('payment_methods', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.string('card_number_masked').notNullable();
    table.string('card_brand').notNullable();
    table.integer('exp_month').notNullable();
    table.integer('exp_year').notNullable();
    table.boolean('is_primary').defaultTo(false).notNullable();
    table.timestamps(true, true);

    table.index(['user_id']);
  });

  // 8. Tabla orders
  await knex.schema.createTable('orders', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('client_id')
      .references('id')
      .inTable('client_profiles')
      .onDelete('RESTRICT')
      .notNullable();
    table
      .uuid('worker_id')
      .references('id')
      .inTable('worker_profiles')
      .onDelete('RESTRICT')
      .notNullable();
    table
      .uuid('category_id')
      .references('id')
      .inTable('categories')
      .onDelete('RESTRICT')
      .notNullable();
    table
      .uuid('location_id')
      .references('id')
      .inTable('locations')
      .onDelete('RESTRICT')
      .notNullable();
    table.string('status').defaultTo('PENDING').notNullable(); // PENDING, ACCEPTED, REJECTED, IN_PROGRESS, COMPLETED, CANCELLED
    table.timestamps(true, true);

    table.index(['client_id']);
    table.index(['worker_id']);
    table.index(['status']);
    table.index(['created_at']);
  });

  // 9. Tabla quotes
  await knex.schema.createTable('quotes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('order_id').references('id').inTable('orders').onDelete('CASCADE').notNullable();
    table.decimal('proposed_price', 10, 2).notNullable();
    table.date('proposed_date').notNullable();
    table.time('proposed_time').notNullable();
    table.string('status').defaultTo('PENDING').notNullable(); // PENDING, ACCEPTED, REJECTED
    table.timestamps(true, true);

    table.index(['order_id']);
    table.index(['status']);
  });

  // 10. Tabla chats
  await knex.schema.createTable('chats', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id_1').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.uuid('user_id_2').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.uuid('order_id').references('id').inTable('orders').onDelete('SET NULL');
    table.timestamp('last_message_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamps(true, true);

    table.index(['user_id_1']);
    table.index(['user_id_2']);
    table.index(['order_id']);
    table.index(['last_message_at']);
  });

  // 11. Tabla messages
  await knex.schema.createTable('messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('chat_id').references('id').inTable('chats').onDelete('CASCADE').notNullable();
    table.uuid('sender_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.text('content').notNullable();
    table.string('message_type').defaultTo('TEXT').notNullable(); // TEXT, IMAGE, QUOTE
    table.string('attachment_url');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['chat_id']);
    table.index(['sender_id']);
    table.index(['created_at']);
  });

  // 12. Tabla transactions
  await knex.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('order_id').references('id').inTable('orders').onDelete('RESTRICT').notNullable();
    table.uuid('payer_id').references('id').inTable('users').onDelete('RESTRICT').notNullable();
    table.uuid('receiver_id').references('id').inTable('users').onDelete('RESTRICT').notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.string('status').defaultTo('PENDING').notNullable(); // PENDING, ESCROWED, COMPLETED, REFUNDED
    table
      .uuid('payment_method_id')
      .references('id')
      .inTable('payment_methods')
      .onDelete('SET NULL');
    table.timestamps(true, true);

    table.index(['order_id']);
    table.index(['payer_id']);
    table.index(['receiver_id']);
    table.index(['status']);
    table.index(['created_at']);
  });

  // 13. Tabla ratings
  await knex.schema.createTable('ratings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('order_id').references('id').inTable('orders').onDelete('CASCADE').notNullable();
    table.uuid('rater_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.uuid('ratee_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.integer('rating_stars').notNullable();
    table.text('review_text');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['order_id']);
    table.index(['rater_id']);
    table.index(['ratee_id']);
    table.index(['created_at']);
  });

  // 14. Tabla disputes
  await knex.schema.createTable('disputes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('order_id').references('id').inTable('orders').onDelete('RESTRICT').notNullable();
    table.uuid('opened_by_id').references('id').inTable('users').onDelete('RESTRICT').notNullable();
    table.text('reason').notNullable();
    table.string('evidence_url');
    table.string('status').defaultTo('OPEN').notNullable(); // OPEN, RESOLVED, CLOSED
    table.text('resolution_notes');
    table.timestamps(true, true);

    table.index(['order_id']);
    table.index(['opened_by_id']);
    table.index(['status']);
    table.index(['created_at']);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // Eliminar tablas en orden inverso para evitar conflictos de claves foráneas
  await knex.schema.dropTableIfExists('disputes');
  await knex.schema.dropTableIfExists('ratings');
  await knex.schema.dropTableIfExists('transactions');
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('chats');
  await knex.schema.dropTableIfExists('quotes');
  await knex.schema.dropTableIfExists('orders');
  await knex.schema.dropTableIfExists('payment_methods');
  await knex.schema.dropTableIfExists('certifications');
  await knex.schema.dropTableIfExists('worker_profiles');
  await knex.schema.dropTableIfExists('client_profiles');
  await knex.schema.dropTableIfExists('locations');
  await knex.schema.dropTableIfExists('categories');
  await knex.schema.dropTableIfExists('users');
}
