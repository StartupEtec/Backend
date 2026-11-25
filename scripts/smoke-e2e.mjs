import fs from 'node:fs';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const CLIENT_EMAIL = 'cliente1@test.com';
const WORKER_EMAIL = 'worker1@test.com';
const PASSWORD = 'test123!';
const CLIENT_OTP = process.env.CLIENT_OTP;
const WORKER_OTP = process.env.WORKER_OTP;
const OTP_LOG_FILE = process.env.OTP_LOG_FILE;
const FUTURE_DATE = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

if ((!CLIENT_OTP || !WORKER_OTP) && !OTP_LOG_FILE) {
  console.error('Faltan CLIENT_OTP y/o WORKER_OTP, o bien OTP_LOG_FILE.');
  process.exit(1);
}

const ok = (message) => console.log(`OK  ${message}`);

function readLatestOtp(email) {
  if (!OTP_LOG_FILE || !fs.existsSync(OTP_LOG_FILE)) return null;
  const line = fs
    .readFileSync(OTP_LOG_FILE, 'utf8')
    .split(/\n/)
    .filter((entry) => entry.includes('[OTP]') && entry.includes(email))
    .at(-1);
  return line?.match(/es:\s*(\d{6})/)?.[1] || null;
}

async function request(method, path, { token, body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${text}`);
  }

  return payload;
}

async function loginWithOtp(email, otpCode) {
  const pending = await request('POST', '/auth/login', {
    body: { email, password: PASSWORD },
  });
  if (pending.status !== 'PENDING_VERIFICATION') {
    throw new Error(`login de ${email} no devolvió PENDING_VERIFICATION`);
  }
  ok(`login ${email}`);

  const code = otpCode || readLatestOtp(email);
  if (!code) throw new Error(`No se pudo obtener el OTP de ${email}`);

  const verified = await request('POST', '/auth/verify-otp', {
    body: { email, otp_code: String(code) },
  });
  if (!verified.accessToken) {
    throw new Error(`verify-otp de ${email} no devolvió accessToken`);
  }
  ok(`verify-otp ${email}`);

  return verified.accessToken;
}

async function main() {
  await request('GET', '/health');
  ok('health');

  const clientToken = await loginWithOtp(CLIENT_EMAIL, CLIENT_OTP);
  const clientMe = await request('GET', '/users/me', { token: clientToken });
  const clientId = clientMe.profile?.client?.id;
  const clientUserId = clientMe.id;
  if (!clientId || !clientUserId) throw new Error('No se pudo obtener el perfil cliente');
  ok('perfil cliente');

  await request('GET', '/categories');
  ok('categorías activas');

  const locations = await request('GET', `/users/${clientUserId}/locations`, { token: clientToken });
  const location = locations.locations?.[0];
  if (!location?.id) throw new Error('El cliente no tiene ubicaciones sembradas');
  ok('ubicación cliente');

  const nearby = await request(
    'GET',
    `/workers/nearby?latitude=${location.latitude}&longitude=${location.longitude}&radius_km=20`,
    { token: clientToken },
  );
  if (!nearby.count) throw new Error('La búsqueda de trabajadores devolvió 0 resultados');
  ok('búsqueda de trabajadores');

  const workerToken = await loginWithOtp(WORKER_EMAIL, WORKER_OTP);
  const workerMe = await request('GET', '/users/me', { token: workerToken });
  const workerId = workerMe.profile?.worker?.id;
  const categoryId = workerMe.profile?.worker?.category_id;
  if (!workerId || !categoryId) throw new Error('No se pudo obtener el perfil trabajador');
  ok('perfil trabajador');

  const createdOrder = await request('POST', '/orders', {
    token: clientToken,
    body: {
      client_id: clientId,
      worker_id: workerId,
      category_id: categoryId,
      location_id: location.id,
      description: 'Reparar la canilla de la cocina',
      suggested_budget: 9000,
      scheduled_date: FUTURE_DATE,
    },
  });
  const orderId = createdOrder.order?.id;
  if (!orderId) throw new Error('La creación de orden no devolvió order.id');
  ok(`orden creada ${orderId} (PENDING)`);

  const createdQuote = await request('POST', `/orders/${orderId}/quotes`, {
    token: workerToken,
    body: {
      proposed_price: 8500,
      proposed_date: FUTURE_DATE,
      proposed_time: '10:30',
    },
  });
  const quoteId = createdQuote.quote?.id;
  if (!quoteId) throw new Error('La creación de cotización no devolvió quote.id');
  ok(`cotización creada ${quoteId}`);

  await request('PATCH', `/quotes/${quoteId}`, {
    token: clientToken,
    body: { status: 'ACCEPTED' },
  });
  ok('cotización aceptada / escrow iniciado');

  const started = await request('PATCH', `/orders/${orderId}/status`, {
    token: workerToken,
    body: { status: 'IN_PROGRESS' },
  });
  if (started.order?.status !== 'IN_PROGRESS') {
    throw new Error('La orden no pasó a IN_PROGRESS');
  }
  ok('orden IN_PROGRESS');

  const detail = await request('GET', `/orders/${orderId}`, { token: clientToken });
  await request('GET', `/orders/${orderId}/history`, { token: clientToken });
  if (detail.order?.status !== 'IN_PROGRESS') {
    throw new Error('El detalle de la orden no muestra IN_PROGRESS');
  }
  ok('detalle e historial verificados');

  console.log('SMOKE E2E OK');
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
