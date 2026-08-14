import { jest } from '@jest/globals';

const makeBuilder = () => {
  const builder = {
    where: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue([{ count: 0 }]),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    increment: jest.fn().mockResolvedValue(1),
    decrement: jest.fn().mockResolvedValue(1),
    then: (onFulfilled) => Promise.resolve([]).then(onFulfilled),
  };
  builder.insert.mockImplementation(() => builder);
  builder.returning.mockImplementation(() => builder);
  return builder;
};

const builders = {};
const getBuilder = (table) => {
  if (!builders[table]) {
    builders[table] = makeBuilder();
  }
  return builders[table];
};

const mockKnex = Object.assign((table) => getBuilder(table), {
  transaction: async (cb) => {
    const trx = Object.assign((table) => getBuilder(table), {
      fn: { now: () => new Date() },
    });
    return cb(trx);
  },
  fn: { now: () => new Date() },
  raw: (val) => val,
});

jest.unstable_mockModule('../src/database/db.js', () => ({
  default: mockKnex,
}));

// Mock encryption module dynamically to return specific strings for 3DS simulation
jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  decrypt: (val) => {
    if (val === 'encrypted-3ds-card') {
      return '4111111111113021';
    }
    return '4111111111111111';
  },
  encrypt: (val) => 'encrypted-' + val,
}));

const { default: paymentService } = await import('../src/services/PaymentService.js');
const { default: paymentController } = await import('../src/controllers/PaymentController.js');

describe('Payment Gateway Integration Tests', () => {
  beforeEach(() => {
    // Reset all builders
    Object.keys(builders).forEach((key) => {
      delete builders[key];
    });
  });

  describe('PaymentService processStripePayment', () => {
    test('returns ORDER_NOT_FOUND if order does not exist', async () => {
      getBuilder('orders').first.mockResolvedValue(null);

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.error).toBe('ORDER_NOT_FOUND');
    });

    test('returns FORBIDDEN if user is not client owner of the order', async () => {
      getBuilder('orders').first.mockResolvedValue({
        id: 'order-uuid',
        client_id: 'client-uuid-1',
      });
      getBuilder('client_profiles').first.mockResolvedValue({
        id: 'client-uuid-2',
        user_id: 'user-uuid',
      });

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.error).toBe('FORBIDDEN');
    });

    test('completes charge successfully synchronously (succeeded)', async () => {
      getBuilder('orders').first.mockResolvedValue({
        id: 'order-uuid',
        client_id: 'client-uuid',
        worker_id: 'worker-uuid',
        status: 'PENDING',
      });
      getBuilder('client_profiles').first.mockResolvedValue({
        id: 'client-uuid',
        user_id: 'user-uuid',
      });
      getBuilder('payment_methods').first.mockResolvedValue({
        id: 'method-uuid',
        user_id: 'user-uuid',
        encrypted_card_number: 'encrypted-card-data',
      });
      getBuilder('transactions').first.mockResolvedValue(null); // existingTx
      // Inside transaction, it gets the created transaction
      getBuilder('transactions').first.mockResolvedValue({ id: 'tx-uuid' });

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.status).toBe('succeeded');
    });

    test('returns requires_action for 3D Secure card (ends with 3021)', async () => {
      getBuilder('orders').first.mockResolvedValue({
        id: 'order-uuid',
        client_id: 'client-uuid',
        worker_id: 'worker-uuid',
        status: 'PENDING',
      });
      getBuilder('client_profiles').first.mockResolvedValue({
        id: 'client-uuid',
        user_id: 'user-uuid',
      });
      getBuilder('payment_methods').first.mockResolvedValue({
        id: 'method-uuid',
        user_id: 'user-uuid',
        encrypted_card_number: 'encrypted-3ds-card', // triggers 3ds decrypted return in our mock
      });
      getBuilder('transactions').first.mockResolvedValue(null);

      const res = await paymentService.processStripePayment(
        'order-uuid',
        'method-uuid',
        100,
        'user-uuid',
      );
      expect(res.status).toBe('requires_action');
      expect(res.client_secret).toBeDefined();
    });
  });

  describe('PaymentController endpoints', () => {
    const makeRes = () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      return res;
    };

    test('stripeWebhook returns 400 when signature header is missing', async () => {
      const req = {
        headers: {},
      };
      const res = makeRes();
      await paymentController.stripeWebhook(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toBe('BAD_REQUEST');
    });

    test('stripeWebhook processes payment_intent.succeeded event successfully', async () => {
      const req = {
        headers: { 'stripe-signature': 'mock_signature' },
        rawBody: Buffer.from(
          JSON.stringify({
            type: 'payment_intent.succeeded',
            data: {
              object: {
                amount: 10000,
                metadata: {
                  order_id: 'order-uuid',
                  payer_id: 'payer-uuid',
                  receiver_id: 'receiver-uuid',
                  payment_method_id: 'pm-uuid',
                },
              },
            },
          }),
        ),
      };
      const res = makeRes();

      getBuilder('orders').first.mockResolvedValue({ id: 'order-uuid', status: 'PENDING' });
      getBuilder('transactions').first.mockResolvedValue(null); // existingTx
      getBuilder('transactions').first.mockResolvedValue({ id: 'inserted-tx-uuid' });

      await paymentController.stripeWebhook(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });
  });
});
