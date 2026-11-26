import { jest } from '@jest/globals';

const builders = {};

const makeBuilder = () => ({
  leftJoin: jest.fn().mockReturnThis(),
  join: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([{ id: REQUEST_ID }]),
  update: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  count: jest.fn().mockResolvedValue([{ count: 1 }]),
});

const mockKnex = jest.fn();

const setupMockKnex = () => {
  mockKnex.mockImplementation((table) => {
    if (!builders[table]) builders[table] = makeBuilder();
    return builders[table];
  });
  mockKnex.raw = jest.fn((value) => value);
  mockKnex.fn = { now: () => new Date() };
  mockKnex.transaction = jest.fn(async (cb) => {
    const trx = jest.fn((table) => {
      if (!builders[table]) builders[table] = makeBuilder();
      return builders[table];
    });
    trx.fn = { now: () => new Date() };
    return cb(trx);
  });
};

const notificationServiceMock = {
  send: jest.fn().mockResolvedValue({ id: 'notif-1' }),
};
const quoteServiceMock = {
  formatQuote: jest.fn((row) => ({ ...row })),
};

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));
jest.unstable_mockModule('../src/services/NotificationService.js', () => ({
  default: notificationServiceMock,
}));
jest.unstable_mockModule('../src/services/QuoteService.js', () => ({
  default: quoteServiceMock,
}));

const { default: quoteRequestService } = await import('../src/services/QuoteRequestService.js');
const { default: quoteRequestController } =
  await import('../src/controllers/QuoteRequestController.js');

const CLIENT_ID = '11111111-1111-1111-1111-111111111111';
const WORKER_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_ID = '99999999-9999-9999-9999-999999999999';
const REQUEST_ID = '33333333-3333-3333-3333-333333333333';
const CATEGORY_ID = '44444444-4444-4444-4444-444444444444';
const ORDER_ID = '55555555-5555-5555-5555-555555555555';
const QUOTE_ID = '66666666-6666-6666-6666-666666666666';

const CLIENT_PROFILE = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', user_id: CLIENT_ID };
const WORKER_PROFILE = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', user_id: WORKER_ID };
const REQUEST_ROW = {
  id: REQUEST_ID,
  client_id: CLIENT_ID,
  worker_id: WORKER_ID,
  category_id: CATEGORY_ID,
  location_id: null,
  description: 'Necesito una reparación',
  budget: 1000,
  scheduled_date: new Date('2026-12-01T00:00:00.000Z'),
  status: 'PENDING',
  rejection_reason: null,
  order_id: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const freshBuilders = () => {
  Object.keys(builders).forEach((key) => delete builders[key]);
};

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('QuoteRequestService', () => {
  beforeEach(() => {
    freshBuilders();
    setupMockKnex();
    notificationServiceMock.send.mockResolvedValue({ id: 'notif-1' });
    quoteServiceMock.formatQuote.mockImplementation((row) => ({ ...row }));
  });

  it('crea una solicitud en estado PENDING sin orden vinculada', async () => {
    builders.client_profiles = makeBuilder();
    builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE);
    builders.worker_profiles = makeBuilder();
    builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE);
    builders.categories = makeBuilder();
    builders.categories.first.mockResolvedValue({ id: CATEGORY_ID, active: true });
    builders.quote_requests = makeBuilder();
    builders.quote_requests.returning.mockResolvedValue([REQUEST_ROW]);

    const result = await quoteRequestService.create(CLIENT_ID, {
      worker_id: WORKER_ID,
      category_id: CATEGORY_ID,
      description: REQUEST_ROW.description,
      budget: 1000,
    });

    expect(result.status).toBe('PENDING');
    expect(result.order_id).toBeNull();
    expect(builders.quote_requests.insert).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: CLIENT_ID, worker_id: WORKER_ID }),
    );
    expect(notificationServiceMock.send).toHaveBeenCalledWith(
      WORKER_ID,
      'SERVICE_REQUEST',
      expect.any(Object),
    );
  });

  it('rechaza crear una solicitud si el cliente no tiene perfil', async () => {
    builders.client_profiles = makeBuilder();
    builders.worker_profiles = makeBuilder();
    builders.categories = makeBuilder();

    const result = await quoteRequestService.create(CLIENT_ID, {
      worker_id: WORKER_ID,
      category_id: CATEGORY_ID,
    });

    expect(result.error).toBe('CLIENT_PROFILE_REQUIRED');
  });

  it('crea la orden y la cotización desde una solicitud y guarda el order_id', async () => {
    builders.quote_requests = makeBuilder();
    builders.quote_requests.first.mockResolvedValue(REQUEST_ROW);
    builders.worker_profiles = makeBuilder();
    builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE);
    builders.client_profiles = makeBuilder();
    builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE);
    builders.orders = makeBuilder();
    builders.orders.returning.mockResolvedValue([{ id: ORDER_ID }]);
    builders.quotes = makeBuilder();
    builders.quotes.returning.mockResolvedValue([
      {
        id: QUOTE_ID,
        order_id: ORDER_ID,
        proposed_price: 1500,
        proposed_date: '2026-12-01',
        proposed_time: '10:30',
        status: 'PENDING',
        rejection_reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const result = await quoteRequestService.createQuoteFromRequest(REQUEST_ID, WORKER_ID, {
      proposed_price: 1500,
      proposed_date: '2026-12-01',
      proposed_time: '10:30',
    });

    expect(result.order_id).toBe(ORDER_ID);
    expect(result.id).toBe(QUOTE_ID);
    expect(builders.orders.insert).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: CLIENT_PROFILE.id, worker_id: WORKER_PROFILE.id }),
    );
    expect(builders.quotes.insert).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: ORDER_ID, proposed_price: 1500 }),
    );
    expect(builders.quote_requests.update).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: ORDER_ID }),
    );
  });

  it('impide cotizar a un trabajador que no es el solicitado', async () => {
    builders.quote_requests = makeBuilder();
    builders.quote_requests.first.mockResolvedValue(REQUEST_ROW);
    builders.worker_profiles = makeBuilder();
    builders.worker_profiles.first.mockResolvedValue({ ...WORKER_PROFILE, user_id: OTHER_ID });

    const result = await quoteRequestService.createQuoteFromRequest(REQUEST_ID, OTHER_ID, {
      proposed_price: 1500,
      proposed_date: '2026-12-01',
      proposed_time: '10:30',
    });

    expect(result.error).toBe('FORBIDDEN');
    expect(builders.quotes).toBeUndefined();
  });

  it('permite al cliente rechazar su propia solicitud con motivo', async () => {
    builders.quote_requests = makeBuilder();
    builders.quote_requests.first.mockResolvedValue(REQUEST_ROW);
    const rejected = { ...REQUEST_ROW, status: 'REJECTED', rejection_reason: 'Ya no lo necesito' };
    builders['quote_requests as qr'] = makeBuilder();
    builders['quote_requests as qr'].first.mockResolvedValue(rejected);
    builders.client_profiles = makeBuilder();
    builders.categories = makeBuilder();

    const result = await quoteRequestService.updateStatus(REQUEST_ID, CLIENT_ID, {
      status: 'REJECTED',
      rejection_reason: 'Ya no lo necesito',
    });

    expect(result.status).toBe('REJECTED');
    expect(result.rejection_reason).toBe('Ya no lo necesito');
    expect(builders.quote_requests.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'REJECTED', rejection_reason: 'Ya no lo necesito' }),
    );
  });

  it('impide que un tercero rechace la solicitud', async () => {
    builders.quote_requests = makeBuilder();
    builders.quote_requests.first.mockResolvedValue(REQUEST_ROW);

    const result = await quoteRequestService.updateStatus(REQUEST_ID, OTHER_ID, {
      status: 'REJECTED',
    });

    expect(result.error).toBe('FORBIDDEN');
  });

  it('permite al cliente eliminar su solicitud PENDING', async () => {
    builders.quote_requests = makeBuilder();
    builders.quote_requests.first.mockResolvedValue(REQUEST_ROW);

    await expect(quoteRequestService.remove(REQUEST_ID, CLIENT_ID)).resolves.toBe(true);
    expect(builders.quote_requests.del).toHaveBeenCalled();
  });

  it('no permite al trabajador eliminar la solicitud', async () => {
    builders.quote_requests = makeBuilder();
    builders.quote_requests.first.mockResolvedValue(REQUEST_ROW);

    const result = await quoteRequestService.remove(REQUEST_ID, WORKER_ID);

    expect(result.error).toBe('FORBIDDEN');
    expect(builders.quote_requests.del).not.toHaveBeenCalled();
  });
});

describe('QuoteRequestController', () => {
  const req = (body = {}, query = {}) => ({
    params: { id: REQUEST_ID },
    user: { user_id: CLIENT_ID },
    body,
    query,
  });

  const setupRequestBuilders = (row = REQUEST_ROW) => {
    builders.quote_requests = makeBuilder();
    builders.quote_requests.first.mockResolvedValue(row);
  };

  const setupFetchBuilders = () => {
    builders['quote_requests as qr'] = makeBuilder();
    builders['quote_requests as qr'].first.mockResolvedValue(REQUEST_ROW);
    builders['quote_requests as qr'].count.mockResolvedValue([{ count: 1 }]);
    builders['quote_requests as qr'].offset.mockResolvedValue([REQUEST_ROW]);
  };

  const setupCreateBuilders = () => {
    builders.client_profiles = makeBuilder();
    builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE);
    builders.worker_profiles = makeBuilder();
    builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE);
    builders.categories = makeBuilder();
    builders.categories.first.mockResolvedValue({ id: CATEGORY_ID, active: true });
    builders.quote_requests = makeBuilder();
    builders.quote_requests.returning.mockResolvedValue([REQUEST_ROW]);
  };

  const setupQuoteBuilders = () => {
    builders.quote_requests = makeBuilder();
    builders.quote_requests.first.mockResolvedValue(REQUEST_ROW);
    builders.worker_profiles = makeBuilder();
    builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE);
    builders.client_profiles = makeBuilder();
    builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE);
    builders.orders = makeBuilder();
    builders.orders.returning.mockResolvedValue([{ id: ORDER_ID }]);
    builders.quotes = makeBuilder();
    builders.quotes.returning.mockResolvedValue([
      {
        id: QUOTE_ID,
        order_id: ORDER_ID,
        proposed_price: 1500,
        proposed_date: '2026-12-01',
        proposed_time: '10:30',
        status: 'PENDING',
        rejection_reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  };

  beforeEach(() => {
    freshBuilders();
    setupMockKnex();
    notificationServiceMock.send.mockResolvedValue({ id: 'notif-1' });
    quoteServiceMock.formatQuote.mockImplementation((row) => ({ ...row }));
  });

  it('valida el cuerpo al crear una solicitud', async () => {
    const res = buildRes();
    await quoteRequestController.create(req(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR' }));
  });

  it('devuelve 400 si el cliente no tiene perfil', async () => {
    setupCreateBuilders();
    builders.client_profiles.first.mockResolvedValue(null);
    const res = buildRes();

    await quoteRequestController.create(
      req({ worker_id: WORKER_ID, category_id: CATEGORY_ID }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'CLIENT_PROFILE_REQUIRED' }),
    );
  });

  it('devuelve 201 al crear una solicitud', async () => {
    setupCreateBuilders();
    const res = buildRes();

    await quoteRequestController.create(
      req({ worker_id: WORKER_ID, category_id: CATEGORY_ID, budget: 1000 }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ request: expect.objectContaining({ status: 'PENDING' }) }),
    );
  });

  it('valida los filtros de listado y devuelve las solicitudes', async () => {
    setupFetchBuilders();
    const invalidRes = buildRes();
    await quoteRequestController.list(req({}, { limit: 500 }), invalidRes, jest.fn());
    expect(invalidRes.status).toHaveBeenCalledWith(400);

    const res = buildRes();
    await quoteRequestController.list(req({}, { status: 'PENDING' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1, requests: expect.any(Array) }),
    );
  });

  it('devuelve 404 si la solicitud no existe', async () => {
    setupFetchBuilders();
    builders['quote_requests as qr'].first.mockResolvedValue(null);
    const res = buildRes();

    await quoteRequestController.getById(req(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'REQUEST_NOT_FOUND' }));
  });

  it('devuelve 200 con el detalle de la solicitud', async () => {
    setupFetchBuilders();
    const res = buildRes();

    await quoteRequestController.getById(req(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: REQUEST_ID }));
  });

  it('valida el cuerpo al cotizar una solicitud', async () => {
    const res = buildRes();
    await quoteRequestController.createQuote(req(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('devuelve 403 si el trabajador no es el solicitado', async () => {
    setupQuoteBuilders();
    builders.worker_profiles.first.mockResolvedValue({ ...WORKER_PROFILE, user_id: OTHER_ID });
    const res = buildRes();

    await quoteRequestController.createQuote(
      req({ proposed_price: 1500, proposed_date: '2026-12-01', proposed_time: '10:30' }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('devuelve 201 al cotizar desde la solicitud', async () => {
    setupQuoteBuilders();
    const res = buildRes();

    await quoteRequestController.createQuote(
      req({ proposed_price: 1500, proposed_date: '2026-12-01', proposed_time: '10:30' }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ quote: expect.objectContaining({ order_id: ORDER_ID }) }),
    );
  });

  it('valida el estado y el motivo antes de actualizar una solicitud', async () => {
    const res = buildRes();
    const next = jest.fn();

    await quoteRequestController.updateStatus(req({ status: 'WRONG' }), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('devuelve 404 al actualizar una solicitud inexistente', async () => {
    setupRequestBuilders(null);
    const res = buildRes();

    await quoteRequestController.updateStatus(req({ status: 'REJECTED' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('devuelve 409 si la transición de estado no es válida', async () => {
    setupRequestBuilders({ ...REQUEST_ROW, status: 'ACCEPTED' });
    const res = buildRes();

    await quoteRequestController.updateStatus(req({ status: 'REJECTED' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('devuelve 200 al rechazar con motivo', async () => {
    setupRequestBuilders();
    setupFetchBuilders();
    const res = buildRes();

    await quoteRequestController.updateStatus(
      req({ status: 'REJECTED', rejection_reason: 'Ya no lo necesito' }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('devuelve 200 al eliminar una solicitud PENDING', async () => {
    setupRequestBuilders();
    const res = buildRes();

    await quoteRequestController.remove(req(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('devuelve 409 si la solicitud no está PENDING', async () => {
    setupRequestBuilders({ ...REQUEST_ROW, status: 'ACCEPTED' });
    const res = buildRes();

    await quoteRequestController.remove(req(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });
});
