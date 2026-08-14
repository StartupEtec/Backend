import { jest } from '@jest/globals';

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  whereNot: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  count: jest.fn().mockResolvedValue([{ count: 0 }]),
  orderBy: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([
    {
      id: 'method-uuid',
      user_id: 'user-uuid',
      card_number_masked: '**** **** **** 1111',
      card_brand: 'Visa',
      exp_month: 12,
      exp_year: 2030,
      cardholder_name: 'Juan Perez',
      is_primary: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]),
  update: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
};

// Define transaction as a plain async function to protect against resets
const mockKnex = Object.assign(() => mockQueryBuilder, {
  transaction: async (cb) => {
    const trx = Object.assign(() => mockQueryBuilder, {
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

const { default: paymentService } = await import('../src/services/PaymentService.js');
const { default: paymentController } = await import('../src/controllers/PaymentController.js');

describe('PaymentService & Controller Tests', () => {
  beforeEach(() => {
    mockQueryBuilder.where.mockReset().mockReturnThis();
    mockQueryBuilder.whereNot.mockReset().mockReturnThis();
    mockQueryBuilder.whereIn.mockReset().mockResolvedValue([]);
    mockQueryBuilder.count.mockReset().mockResolvedValue([{ count: 0 }]);
    mockQueryBuilder.orderBy.mockReset().mockReturnThis();
    mockQueryBuilder.first.mockReset().mockResolvedValue(null);
    mockQueryBuilder.insert.mockReset().mockReturnThis();
    mockQueryBuilder.returning.mockReset().mockResolvedValue([
      {
        id: 'method-uuid',
        user_id: 'user-uuid',
        card_number_masked: '**** **** **** 1111',
        card_brand: 'Visa',
        exp_month: 12,
        exp_year: 2030,
        cardholder_name: 'Juan Perez',
        is_primary: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    mockQueryBuilder.update.mockReset().mockResolvedValue(1);
    mockQueryBuilder.del.mockReset().mockResolvedValue(1);

    mockQueryBuilder.then = (onFulfilled) => Promise.resolve([]).then(onFulfilled);
  });

  describe('PaymentService', () => {
    test('createPaymentMethod exits with LIMIT_EXCEEDED if user has >= 10 cards', async () => {
      mockQueryBuilder.count.mockResolvedValue([{ count: 10 }]);

      const res = await paymentService.createPaymentMethod('user-uuid', {
        card_number: '4111111111111111',
        cvv: '123',
        exp_month: 12,
        exp_year: 2030,
        cardholder_name: 'Juan Perez',
      });

      expect(res.error).toBe('LIMIT_EXCEEDED');
    });

    test('createPaymentMethod succeeds with valid Luhn card', async () => {
      mockQueryBuilder.count.mockResolvedValue([{ count: 1 }]);

      const res = await paymentService.createPaymentMethod('user-uuid', {
        card_number: '4111111111111111',
        cvv: '123',
        exp_month: 12,
        exp_year: 2030,
        cardholder_name: 'Juan Perez',
        is_primary: true,
      });

      expect(res.paymentMethod).toBeDefined();
      expect(res.paymentMethod.card_brand).toBe('Visa');
    });

    test('deletePaymentMethod checks for pending transactions', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 'method-uuid',
        user_id: 'user-uuid',
        is_primary: true,
      });
      mockQueryBuilder.whereIn.mockResolvedValue([{ id: 'tx-uuid', status: 'PENDING' }]);

      const res = await paymentService.deletePaymentMethod('method-uuid', 'user-uuid');
      expect(res.error).toBe('PENDING_TRANSACTIONS');
    });
  });

  describe('PaymentController', () => {
    const makeRes = () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      return res;
    };

    test("list returns 403 if user lists another user's cards", async () => {
      const req = {
        params: { id: 'other-user-uuid' },
        user: { user_id: 'my-user-uuid' },
      };
      const res = makeRes();

      await paymentController.list(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('create returns 400 on Joi validation error (invalid Luhn or card)', async () => {
      const req = {
        params: { id: 'my-user-uuid' },
        user: { user_id: 'my-user-uuid' },
        body: {
          card_number: '4111111111111112',
          cvv: '123',
          exp_month: 12,
          exp_year: 2030,
          cardholder_name: 'Juan Perez',
        },
      };
      const res = makeRes();

      await paymentController.create(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toBe('VALIDATION_ERROR');
    });
  });
});
