const FIELDS = ['full_name', 'date_of_birth', 'avatar_url', 'dni_front_url', 'dni_back_url'];

const normDate = (value) => {
  if (!value) return null;
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
};

export async function up(knex) {
  const hasClient = await knex.schema.hasColumn('client_profiles', 'date_of_birth');
  const hasWorker = await knex.schema.hasColumn('worker_profiles', 'date_of_birth');
  if (!hasClient && !hasWorker) return;

  const users = await knex('users').select('id', ...FIELDS);
  for (const user of users) {
    const missing = FIELDS.filter((f) => user[f] == null);
    if (missing.length === 0) continue;

    let client = null;
    let worker = null;
    if (hasClient) {
      client = await knex('client_profiles')
        .where({ user_id: user.id })
        .select(...FIELDS)
        .first();
    }
    if (hasWorker) {
      worker = await knex('worker_profiles')
        .where({ user_id: user.id })
        .select(...FIELDS)
        .first();
    }
    if (!client && !worker) continue;

    const updates = {};
    for (const field of missing) {
      const value = client?.[field] ?? worker?.[field] ?? null;
      if (value != null) updates[field] = field === 'date_of_birth' ? normDate(value) : value;
    }
    if (Object.keys(updates).length === 0) continue;
    await knex('users').where({ id: user.id }).update(updates);
  }
}

export async function down() {
  // No revierte datos: solo rellenó NULLs, no hay cómo saber qué había antes.
}
