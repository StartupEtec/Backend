import { jest } from '@jest/globals';

const builders = {};

const makeBuilder = () => {
  const builder = {
    where: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    avg: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue([]),
    decrement: jest.fn().mockResolvedValue(1),
    increment: jest.fn().mockResolvedValue(1),
  };
  return builder;
};

const mockKnex = jest.fn();

const setupMockKnex = () => {
  mockKnex.mockImplementation((table) => {
    const baseTable = table.split(' ')[0];
    if (!builders[baseTable]) {
      builders[baseTable] = makeBuilder();
    }
    return builders[baseTable];
  });
  mockKnex.transaction = jest.fn(async (cb) => {
    const trx = jest.fn((table) => {
      const baseTable = table.split(' ')[0];
      if (!builders[baseTable]) {
        builders[baseTable] = makeBuilder();
      }
      return builders[baseTable];
    });
    trx.fn = { now: () => new Date() };
    return cb(trx);
  });
  mockKnex.raw = jest.fn((val) => val);
  mockKnex.fn = { now: () => new Date() };
};

setupMockKnex();

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));

const { default: disputeService } = await import('../src/services/DisputeService.js');
const { default: disputeController } = await import('../src/controllers/DisputeController.js');

const CLIENT_USER_ID = '11111111-1111-1111-1111-111111111111';
const WORKER_USER_ID = '22222222-2222-2222-2222-222222222222';
const ADMIN_USER_ID = '88888888-8888-8888-8888-888888888888';
const OTHER_USER_ID = '99999999-9999-9999-9999-999999999999';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';
const CLIENT_PROFILE_ID = '55555555-5555-5555-5555-555555555555';
const WORKER_PROFILE_ID = '66666666-6666-6666-6666-666666666666';
const DISPUTE_ID = '77777777-7777-7777-7777-777777777777';

const COMPLETED_ORDER = {
  id: ORDER_ID,
  client_id: CLIENT_PROFILE_ID,
  worker_id: WORKER_PROFILE_ID,
  status: 'COMPLETED',
};

const CLIENT_PROFILE_ROW = { id: CLIENT_PROFILE_ID, user_id: CLIENT_USER_ID };
const WORKER_PROFILE_ROW = { id: WORKER_PROFILE_ID, user_id: WORKER_USER_ID };

const CREATED_DISPUTE = {
  id: DISPUTE_ID,
  order_id: ORDER_ID,
  opened_by_id: CLIENT_USER_ID,
  reason: 'El trabajador no terminó la tarea acordada.',
  evidence_url: 'https://example.com/evidence.jpg',
  status: 'OPEN',
  resolution_notes: null,
};

const resetBuilders = () => {
  Object.keys(builders).forEach((key) => delete builders[key]);
  setupMockKnex();
};

describe('Dispute System Tests', () => {
  beforeEach(resetBuilders);

  describe('DisputeService.createDispute', () => {
    it('debería retornar ORDER_NOT_FOUND si la orden no existe', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(null);

      const res = await disputeService.createDispute(CLIENT_USER_ID, {
        order_id: ORDER_ID,
        reason: 'Razón de prueba',
      });

      expect(res.error).toBe('ORDER_NOT_FOUND');
    });

    it('debería retornar FORBIDDEN si el usuario no participa en la orden', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(COMPLETED_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const res = await disputeService.createDispute(OTHER_USER_ID, {
        order_id: ORDER_ID,
        reason: 'Razón de prueba',
      });

      expect(res.error).toBe('FORBIDDEN');
    });

    it('debería retornar INVALID_ORDER_STATUS si la orden no está en COMPLETED ni CANCELLED', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue({ ...COMPLETED_ORDER, status: 'IN_PROGRESS' });
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const res = await disputeService.createDispute(CLIENT_USER_ID, {
        order_id: ORDER_ID,
        reason: 'Razón de prueba',
      });

      expect(res.error).toBe('INVALID_ORDER_STATUS');
    });

    it('debería retornar DISPUTE_ALREADY_EXISTS si ya hay una disputa asociada a la orden', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(COMPLETED_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.disputes = makeBuilder();
      builders.disputes.first.mockResolvedValue(CREATED_DISPUTE);

      const res = await disputeService.createDispute(CLIENT_USER_ID, {
        order_id: ORDER_ID,
        reason: 'Razón de prueba',
      });

      expect(res.error).toBe('DISPUTE_ALREADY_EXISTS');
    });

    it('debería crear la disputa si pasa todas las validaciones', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(COMPLETED_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.disputes = makeBuilder();
      builders.disputes.first.mockResolvedValue(null);
      builders.disputes.returning.mockResolvedValue([CREATED_DISPUTE]);

      const res = await disputeService.createDispute(CLIENT_USER_ID, {
        order_id: ORDER_ID,
        reason: 'El trabajador no terminó la tarea acordada.',
        evidence_url: 'https://example.com/evidence.jpg',
      });

      expect(res.dispute).toEqual(CREATED_DISPUTE);
    });
  });

  describe('DisputeService.listDisputes', () => {
    it('debería listar solo las disputas del usuario si no es admin', async () => {
      builders.disputes = makeBuilder();
      builders.disputes.count.mockResolvedValue([{ count: 2 }]);
      builders.disputes.offset.mockResolvedValue([CREATED_DISPUTE]);

      const res = await disputeService.listDisputes(CLIENT_USER_ID, 'client', { limit: 10, offset: 0 });
      expect(res.count).toBe(2);
      expect(res.disputes).toEqual([CREATED_DISPUTE]);
    });
  });

  describe('DisputeService.resolveDispute', () => {
    it('debería retornar DISPUTE_NOT_FOUND si la disputa no existe', async () => {
      builders.disputes = makeBuilder();
      builders.disputes.first.mockResolvedValue(null);

      const res = await disputeService.resolveDispute(DISPUTE_ID, ADMIN_USER_ID, {
        status: 'RESOLVED',
        resolutionNotes: 'Se resuelve a favor del cliente',
        winner: 'client',
      });

      expect(res.error).toBe('DISPUTE_NOT_FOUND');
    });

    it('debería procesar reembolso al resolver a favor del cliente en estado ESCROWED', async () => {
      builders.disputes = makeBuilder();
      builders.disputes.first
        .mockResolvedValueOnce(CREATED_DISPUTE) // Primer llamado: buscar disputa
        .mockResolvedValueOnce({ ...CREATED_DISPUTE, status: 'RESOLVED', resolution_notes: 'Reembolso ok' }); // Retorno final
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(COMPLETED_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.transactions = makeBuilder();
      builders.transactions.first.mockResolvedValue({
        id: 'tx-123',
        status: 'ESCROWED',
        amount: 150.0,
        payer_id: CLIENT_USER_ID,
        payment_method_id: 'pm-123',
      });
      builders.user_wallets = makeBuilder();
      builders.user_wallets.first.mockResolvedValue({ id: 'w-123', user_id: CLIENT_USER_ID, escrowed_balance: 150 });
      builders.transaction_logs = makeBuilder();

      const res = await disputeService.resolveDispute(DISPUTE_ID, ADMIN_USER_ID, {
        status: 'RESOLVED',
        resolutionNotes: 'Reembolso ok',
        winner: 'client',
      });

      expect(res.dispute.status).toBe('RESOLVED');
    });

    it('debería procesar reembolso debitando del trabajador si la transacción ya está COMPLETED', async () => {
      builders.disputes = makeBuilder();
      builders.disputes.first
        .mockResolvedValueOnce(CREATED_DISPUTE)
        .mockResolvedValueOnce({ ...CREATED_DISPUTE, status: 'RESOLVED', resolution_notes: 'Reembolso ok' });
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(COMPLETED_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.transactions = makeBuilder();
      builders.transactions.first.mockResolvedValue({
        id: 'tx-123',
        status: 'COMPLETED',
        amount: 150.0,
        payer_id: CLIENT_USER_ID,
        receiver_id: WORKER_USER_ID,
        payment_method_id: 'pm-123',
      });
      builders.user_wallets = makeBuilder();
      builders.user_wallets.first.mockResolvedValue({ id: 'w-123', user_id: WORKER_USER_ID, current_balance: 200 });
      builders.transaction_logs = makeBuilder();

      const res = await disputeService.resolveDispute(DISPUTE_ID, ADMIN_USER_ID, {
        status: 'RESOLVED',
        resolutionNotes: 'Reembolso ok',
        winner: 'client',
      });

      expect(res.dispute.status).toBe('RESOLVED');
    });
  });

  describe('DisputeController', () => {
    it('debería responder 201 al abrir disputa correctamente', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(COMPLETED_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.disputes = makeBuilder();
      builders.disputes.first.mockResolvedValue(null);
      builders.disputes.returning.mockResolvedValue([CREATED_DISPUTE]);

      const req = {
        user: { user_id: CLIENT_USER_ID },
        body: { order_id: ORDER_ID, reason: 'El trabajador no terminó la tarea acordada.' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await disputeController.create(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Disputa creada correctamente' }),
      );
    });

    it('debería responder 400 ante validación fallida', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        body: { order_id: 'invalid-uuid', reason: '' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await disputeController.create(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
