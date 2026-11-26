const FIELDS = ['full_name', 'date_of_birth', 'avatar_url', 'dni_front_url', 'dni_back_url'];

const normDate = (value) => {
  if (!value) return null;
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
};

export async function up(knex) {
  const users = await knex('users').select('id', ...FIELDS);
  for (const user of users) {
    if (FIELDS.some((f) => user[f] == null)) continue;
    const base = {
      full_name: user.full_name,
      date_of_birth: normDate(user.date_of_birth),
      avatar_url: user.avatar_url,
      dni_front_url: user.dni_front_url,
      dni_back_url: user.dni_back_url,
    };
    const hasClient = await knex('client_profiles').where({ user_id: user.id }).first();
    if (!hasClient) {
      await knex('client_profiles').insert({ user_id: user.id, ...base });
    }
    const hasWorker = await knex('worker_profiles').where({ user_id: user.id }).first();
    if (!hasWorker) {
      await knex('worker_profiles').insert({ user_id: user.id, ...base });
    }
  }
}

export async function down() {
  // No revierte datos: las filas creadas son indistinguibles de las de alta normal.
}
