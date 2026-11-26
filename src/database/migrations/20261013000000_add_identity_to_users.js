/**
 * Identidad única del usuario ("Completar Perfil" una sola vez).
 *
 * 1. Agrega las 5 columnas a users (NULL a propósito: hay usuarios sin
 *    perfil y la obligatoriedad se valida en Joi, no con constraints).
 * 2. Backfill automático: si el usuario ya completó como cliente o como
 *    worker, se copia esa identidad a users (prioridad cliente).
 */
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('full_name');
    table.date('date_of_birth');
    table.text('avatar_url');
    table.text('dni_front_url');
    table.text('dni_back_url');
  });

  const hasClientIdentity = await knex.schema.hasColumn('client_profiles', 'date_of_birth');
  const hasWorkerIdentity = await knex.schema.hasColumn('worker_profiles', 'date_of_birth');
  if (!hasClientIdentity && !hasWorkerIdentity) return;

  const users = await knex('users').select('id');
  for (const { id } of users) {
    let source = null;
    if (hasClientIdentity) {
      source = await knex('client_profiles')
        .where({ user_id: id })
        .select('full_name', 'date_of_birth', 'avatar_url', 'dni_front_url', 'dni_back_url')
        .first();
    }
    if (!source?.date_of_birth && hasWorkerIdentity) {
      const worker = await knex('worker_profiles')
        .where({ user_id: id })
        .select('full_name', 'date_of_birth', 'avatar_url', 'dni_front_url', 'dni_back_url')
        .first();
      source = source?.full_name ? source : worker;
      if (source && !source.date_of_birth) source = worker;
    }
    if (!source || !source.date_of_birth) continue;
    const dob =
      typeof source.date_of_birth === 'string'
        ? source.date_of_birth.slice(0, 10)
        : source.date_of_birth.toISOString().slice(0, 10);
    await knex('users')
      .where({ id })
      .update({
        full_name: source.full_name || null,
        date_of_birth: dob,
        avatar_url: source.avatar_url || null,
        dni_front_url: source.dni_front_url || null,
        dni_back_url: source.dni_back_url || null,
      });
  }
}

export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('full_name');
    table.dropColumn('date_of_birth');
    table.dropColumn('avatar_url');
    table.dropColumn('dni_front_url');
    table.dropColumn('dni_back_url');
  });
}
