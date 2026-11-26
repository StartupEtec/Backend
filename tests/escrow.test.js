import { jest } from '@jest/globals';

const builders = {};

const makeBuilder = () => {
  const builder = {
    where: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(1),
    increment: jest.fn().mockResolvedValue(1),
    decrement: jest.fn().mockResolvedValue(1),
    orderBy: jest.fn().mockResolvedValue([]),
  };
  return builder;
};

const mockKnex = jest.fn();

const setupMockKnex = () => {
  mockKnex.mockImplementation((table) => {
    if (!builders[table]) {
      builders[table] = makeBuilder();
    }
    return builders[table];
  });
  mockKnex.transaction = jest.fn(async (cb) => {
    const trx = jest.fn((table) => {
      if (!builders[table]) {
        builders[table] = makeBuilder();
      }
      return builders[table];
    });
    trx.fn = { now: () => new Date() };
    return cb(trx);
  });
  mockKnex.raw = jest.fn((val) => val);
  mockKnex.fn = { now: () => new Date() };
};

setupMockKnex();

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));

const { default: escrowService } = await import('../src/services/EscrowService.js');

const ORDER_ID = '33333333-3333-3333-3333-333333333333';
const PAYER_ID = '11111111-1111-1111-1111-111111111111';
const RECEIVER_ID = '22222222-2222-2222-2222-222222222222';
const PAYMENT_METHOD_ID = '77777777-7777-7777-7777-777777777777';

const TRANSACTION_ROW = {
  id: '88888888-8888-8888-8888-888888888888',
  order_id: ORDER_ID,
  payer_id: PAYER_ID,
  receiver_id: RECEIVER_ID,
  amount: '35000.00',
  status: 'PENDING',
  payment_method_id: PAYMENT_METHOD_ID,
};

const withTrx = (service, method, args) =>
  mockKnex.transaction((trx) => service[method](trx, args));

const resetBuilders = () => {
  Object.keys(builders).forEach((key) => delete builders[key]);
  setupMockKnex();
};

describe('EscrowService', () => {
  beforeEach(resetBuilders);
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('startEscrow', () => {
    it('should create ESCROWED transaction and retain funds on successful charge', async () => {
      builders.transactions = makeBuilder();
      builders.transactions.returning.mockResolvedValue([TRANSACTION_ROW]);
      builders.transactions.first.mockResolvedValue(null);
      builders.user_wallets = makeBuilder();
      builders.user_wallets.first.mockResolvedValue(null);
      builders.user_wallets.insert.mockReturnThis();
      builders.user_wallets.returning.mockResolvedValue([
        { id: 'wallet-uuid', user_id: PAYER_ID, current_balance: 0, escrowed_balance: 0 },
      ]);

      const result = await withTrx(escrowService, 'startEscrow', {
        orderId: ORDER_ID,
        payerId: PAYER_ID,
        receiverId: RECEIVER_ID,
        amount: '35000.00',
        paymentMethodId: PAYMENT_METHOD_ID,
        actorUserId: PAYER_ID,
      });

      expect(result.success).toBe(true);
      expect(builders.transactions.returning).toHaveBeenCalledWith('*');
      expect(builders.transactions.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ESCROWED' }),
      );
      expect(builders.user_wallets.increment).toHaveBeenCalledWith('escrowed_balance', 35000);
      expect(builders.transaction_logs.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          from_status: 'PENDING',
          to_status: 'ESCROWED',
        }),
      );
    });

    it('should mark transaction FAILED and cancel the order when charge fails', async () => {
      jest.spyOn(escrowService, 'chargeCard').mockResolvedValue({
        success: false,
        reason: 'CARD_DECLINED',
      });

      builders.transactions = makeBuilder();
      builders.transactions.returning.mockResolvedValue([TRANSACTION_ROW]);
      builders.orders = makeBuilder();

      const result = await withTrx(escrowService, 'startEscrow', {
        orderId: ORDER_ID,
        payerId: PAYER_ID,
        receiverId: RECEIVER_ID,
        amount: '35000.00',
        paymentMethodId: PAYMENT_METHOD_ID,
        actorUserId: PAYER_ID,
      });

      expect(result.success).toBe(false);
      expect(builders.transactions.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED' }),
      );
      expect(builders.orders.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CANCELLED' }),
      );
      expect(builders.transaction_logs.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          from_status: 'PENDING',
          to_status: 'FAILED',
        }),
      );
    });

    it('should fail the charge when the client has no payment method', async () => {
      builders.transactions = makeBuilder();
      builders.transactions.returning.mockResolvedValue([TRANSACTION_ROW]);
      builders.orders = makeBuilder();

      const result = await withTrx(escrowService, 'startEscrow', {
        orderId: ORDER_ID,
        payerId: PAYER_ID,
        receiverId: RECEIVER_ID,
        amount: '35000.00',
        paymentMethodId: null,
        actorUserId: PAYER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('CARD_DECLINED');
    });
  });

  describe('releaseFunds', () => {
    it('should transfer funds from client escrow to worker balance and mark COMPLETED', async () => {
      builders.transactions = makeBuilder();
      builders.transactions.first.mockResolvedValue({ ...TRANSACTION_ROW, status: 'ESCROWED' });
      builders.user_wallets = makeBuilder();
      builders.user_wallets.first.mockResolvedValue({ id: 'wallet-uuid', user_id: PAYER_ID });

      const result = await withTrx(escrowService, 'releaseFunds', {
        transactionId: TRANSACTION_ROW.id,
        actorUserId: PAYER_ID,
      });

      expect(result.error).toBeUndefined();
      expect(builders.user_wallets.decrement).toHaveBeenCalledWith('escrowed_balance', 35000);
      expect(builders.user_wallets.increment).toHaveBeenCalledWith('current_balance', 35000);
      expect(builders.transactions.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'COMPLETED' }),
      );
      expect(builders.transaction_logs.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          from_status: 'ESCROWED',
          to_status: 'COMPLETED',
        }),
      );
    });

    it('should return INVALID_TRANSITION if the transaction is not ESCROWED', async () => {
      builders.transactions = makeBuilder();
      builders.transactions.first.mockResolvedValue({ ...TRANSACTION_ROW, status: 'PENDING' });

      const result = await withTrx(escrowService, 'releaseFunds', {
        transactionId: TRANSACTION_ROW.id,
        actorUserId: PAYER_ID,
      });

      expect(result.error).toBe('INVALID_TRANSITION');
      expect(builders.transactions.update).not.toHaveBeenCalled();
    });
  });

  describe('refund', () => {
    it('should refund to card, release client escrow and mark REFUNDED', async () => {
      builders.transactions = makeBuilder();
      builders.transactions.first.mockResolvedValue({ ...TRANSACTION_ROW, status: 'ESCROWED' });
      builders.user_wallets = makeBuilder();
      builders.user_wallets.first.mockResolvedValue({ id: 'wallet-uuid', user_id: PAYER_ID });

      const result = await withTrx(escrowService, 'refund', {
        transactionId: TRANSACTION_ROW.id,
        actorUserId: PAYER_ID,
        reason: 'Orden cancelada',
      });

      expect(result.error).toBeUndefined();
      expect(result.refundReference).toContain('mock_refund_');
      expect(builders.user_wallets.decrement).toHaveBeenCalledWith('escrowed_balance', 35000);
      expect(builders.transactions.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'REFUNDED' }),
      );
      expect(builders.transaction_logs.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          from_status: 'ESCROWED',
          to_status: 'REFUNDED',
          reason: 'Orden cancelada',
        }),
      );
    });

    it('should return REFUND_FAILED when the card refund fails', async () => {
      jest.spyOn(escrowService, 'refundCard').mockResolvedValue({
        success: false,
        reason: 'NO_PAYMENT_METHOD',
      });

      builders.transactions = makeBuilder();
      builders.transactions.first.mockResolvedValue({ ...TRANSACTION_ROW, status: 'ESCROWED' });

      const result = await withTrx(escrowService, 'refund', {
        transactionId: TRANSACTION_ROW.id,
        actorUserId: PAYER_ID,
      });

      expect(result.error).toBe('REFUND_FAILED');
      expect(builders.transactions.update).not.toHaveBeenCalled();
    });
  });
});
