import { jest } from '@jest/globals';

const builders = {};

const makeBuilder = () => {
  const builder = {
    where: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 'quote-uuid' }]),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue([]),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue([{ total: '0' }]),
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

const { default: quoteService } = await import('../src/services/QuoteService.js');
const { default: quoteController } = await import('../src/controllers/QuoteController.js');
const { createQuoteSchema, updateQuoteStatusSchema } = await import('../src/utils/validation.js');

const CLIENT_USER_ID = '11111111-1111-1111-1111-111111111111';
const WORKER_USER_ID = '22222222-2222-2222-2222-222222222222';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';
const QUOTE_ID = '44444444-4444-4444-4444-444444444444';
const CLIENT_PROFILE_ID = '55555555-5555-5555-5555-555555555555';
const WORKER_PROFILE_ID = '66666666-6666-6666-6666-666666666666';

const ORDER_ROW = {
  id: ORDER_ID,
  client_id: CLIENT_PROFILE_ID,
  worker_id: WORKER_PROFILE_ID,
  status: 'PENDING',
};

const CLIENT_PROFILE_ROW = { id: CLIENT_PROFILE_ID, user_id: CLIENT_USER_ID };
const WORKER_PROFILE_ROW = { id: WORKER_PROFILE_ID, user_id: WORKER_USER_ID };

const QUOTE_ROW = {
  id: QUOTE_ID,
  order_id: ORDER_ID,
  proposed_price: '35000.00',
  proposed_date: new Date(2026, 7, 20),
  proposed_time: '14:30:00',
  status: 'PENDING',
  rejection_reason: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const QUOTE_ROW_WITH_ORDER = {
  ...QUOTE_ROW,
  order_client_id: CLIENT_PROFILE_ID,
  order_worker_id: WORKER_PROFILE_ID,
  order_status: 'PENDING',
};

const resetBuilders = () => {
  Object.keys(builders).forEach((key) => delete builders[key]);
  setupMockKnex();
};

describe('QuoteService', () => {
  beforeEach(resetBuilders);

  describe('createQuote', () => {
    it('should return ORDER_NOT_FOUND when the order does not exist', async () => {
      const result = await quoteService.createQuote(WORKER_USER_ID, ORDER_ID, {
        proposed_price: 35000,
        proposed_date: new Date('2026-08-20T00:00:00.000Z'),
        proposed_time: '14:30',
      });

      expect(result).toEqual({ error: 'ORDER_NOT_FOUND' });
    });

    it('should return FORBIDDEN when the user is not the order worker', async () => {
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue({
        ...WORKER_PROFILE_ROW,
        id: 'other-profile',
      });
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW);

      const result = await quoteService.createQuote(WORKER_USER_ID, ORDER_ID, {
        proposed_price: 35000,
        proposed_date: new Date('2026-08-20T00:00:00.000Z'),
        proposed_time: '14:30',
      });

      expect(result).toEqual({ error: 'FORBIDDEN' });
    });

    it('should return FORBIDDEN when the user has no worker profile', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW);

      const result = await quoteService.createQuote(WORKER_USER_ID, ORDER_ID, {
        proposed_price: 35000,
        proposed_date: new Date('2026-08-20T00:00:00.000Z'),
        proposed_time: '14:30',
      });

      expect(result).toEqual({ error: 'FORBIDDEN' });
    });

    it('should return ORDER_NOT_ACTIVE when the order is finished', async () => {
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue({ ...ORDER_ROW, status: 'COMPLETED' });

      const result = await quoteService.createQuote(WORKER_USER_ID, ORDER_ID, {
        proposed_price: 35000,
        proposed_date: new Date('2026-08-20T00:00:00.000Z'),
        proposed_time: '14:30',
      });

      expect(result).toEqual({ error: 'ORDER_NOT_ACTIVE' });
    });

    it('should create a pending quote for the order worker', async () => {
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW);
      builders.quotes = makeBuilder();
      builders.quotes.returning.mockResolvedValue([QUOTE_ROW]);

      const result = await quoteService.createQuote(WORKER_USER_ID, ORDER_ID, {
        proposed_price: 35000,
        proposed_date: new Date('2026-08-20T00:00:00.000Z'),
        proposed_time: '14:30',
      });

      expect(result).toEqual({
        id: QUOTE_ID,
        order_id: ORDER_ID,
        proposed_price: 35000,
        proposed_date: '2026-08-20',
        proposed_time: '14:30:00',
        status: 'PENDING',
        rejection_reason: null,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
      expect(builders.quotes.insert).toHaveBeenCalledWith({
        order_id: ORDER_ID,
        proposed_price: 35000,
        proposed_date: '2026-08-20',
        proposed_time: '14:30',
        status: 'PENDING',
      });
    });
  });

  describe('listQuotesByOrder', () => {
    it('should return ORDER_NOT_FOUND when the order does not exist', async () => {
      const result = await quoteService.listQuotesByOrder(ORDER_ID, CLIENT_USER_ID);
      expect(result).toEqual({ error: 'ORDER_NOT_FOUND' });
    });

    it('should return FORBIDDEN when the user is not a participant', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW);

      const result = await quoteService.listQuotesByOrder(
        ORDER_ID,
        '00000000-0000-0000-0000-000000000000',
      );
      expect(result).toEqual({ error: 'FORBIDDEN' });
    });

    it('should list formatted quotes for a participant', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(null);
      builders.quotes = makeBuilder();
      builders.quotes.orderBy.mockResolvedValue([QUOTE_ROW]);

      const result = await quoteService.listQuotesByOrder(ORDER_ID, CLIENT_USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PENDING');
      expect(builders.quotes.orderBy).toHaveBeenCalledWith('created_at', 'asc');
    });
  });

  describe('getQuoteById', () => {
    it('should return null when the quote does not exist', async () => {
      const result = await quoteService.getQuoteById(QUOTE_ID, CLIENT_USER_ID);
      expect(result).toBeNull();
    });

    it('should return null when the user is not a participant of the order', async () => {
      builders['quotes as q'] = makeBuilder();
      builders['quotes as q'].first.mockResolvedValue(QUOTE_ROW_WITH_ORDER);

      const result = await quoteService.getQuoteById(
        QUOTE_ID,
        '00000000-0000-0000-0000-000000000000',
      );
      expect(result).toBeNull();
    });

    it('should return the formatted quote for a participant', async () => {
      builders['quotes as q'] = makeBuilder();
      builders['quotes as q'].first.mockResolvedValue(QUOTE_ROW_WITH_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(null);

      const result = await quoteService.getQuoteById(QUOTE_ID, CLIENT_USER_ID);

      expect(result.id).toBe(QUOTE_ID);
      expect(result.proposed_price).toBe(35000);
    });
  });

  describe('updateQuoteStatus', () => {
    it('should return QUOTE_NOT_FOUND when the quote does not exist', async () => {
      const result = await quoteService.updateQuoteStatus(QUOTE_ID, CLIENT_USER_ID, {
        status: 'REJECTED',
      });
      expect(result).toEqual({ error: 'QUOTE_NOT_FOUND' });
    });

    it('should return FORBIDDEN when a worker tries to accept', async () => {
      builders['quotes as q'] = makeBuilder();
      builders['quotes as q'].first.mockResolvedValue(QUOTE_ROW_WITH_ORDER);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(null);

      const result = await quoteService.updateQuoteStatus(QUOTE_ID, WORKER_USER_ID, {
        status: 'ACCEPTED',
      });
      expect(result).toEqual({ error: 'FORBIDDEN' });
    });

    it('should return INVALID_TRANSITION when the quote is not PENDING', async () => {
      builders['quotes as q'] = makeBuilder();
      builders['quotes as q'].first.mockResolvedValue({
        ...QUOTE_ROW_WITH_ORDER,
        status: 'ACCEPTED',
      });
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(null);

      const result = await quoteService.updateQuoteStatus(QUOTE_ID, CLIENT_USER_ID, {
        status: 'REJECTED',
      });
      expect(result.error).toBe('INVALID_TRANSITION');
      expect(result.message).toContain('ACCEPTED');
    });

    it('should reject a pending quote storing the optional reason', async () => {
      builders['quotes as q'] = makeBuilder();
      builders['quotes as q'].first
        .mockResolvedValueOnce(QUOTE_ROW_WITH_ORDER)
        .mockResolvedValueOnce({
          ...QUOTE_ROW_WITH_ORDER,
          status: 'REJECTED',
          rejection_reason: 'El precio supera mi presupuesto',
        });
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(null);

      const result = await quoteService.updateQuoteStatus(QUOTE_ID, CLIENT_USER_ID, {
        status: 'REJECTED',
        rejection_reason: 'El precio supera mi presupuesto',
      });

      expect(result.status).toBe('REJECTED');
      expect(builders.quotes.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'REJECTED',
          rejection_reason: 'El precio supera mi presupuesto',
        }),
      );
    });

    it('should allow the worker to cancel their own pending quote', async () => {
      builders['quotes as q'] = makeBuilder();
      builders['quotes as q'].first
        .mockResolvedValueOnce(QUOTE_ROW_WITH_ORDER)
        .mockResolvedValueOnce({ ...QUOTE_ROW_WITH_ORDER, status: 'CANCELLED' });
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(null);

      const result = await quoteService.updateQuoteStatus(QUOTE_ID, WORKER_USER_ID, {
        status: 'CANCELLED',
      });

      expect(result.status).toBe('CANCELLED');
    });

    it('should accept a quote atomically: reject siblings, accept order and start payment', async () => {
      builders['quotes as q'] = makeBuilder();
      builders['quotes as q'].first.mockResolvedValue(QUOTE_ROW_WITH_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      builders.quotes = makeBuilder();
      builders.quotes.first.mockResolvedValue({ ...QUOTE_ROW, status: 'ACCEPTED' });
      builders.orders = makeBuilder();
      builders.transactions = makeBuilder();

      const result = await quoteService.updateQuoteStatus(QUOTE_ID, CLIENT_USER_ID, {
        status: 'ACCEPTED',
      });

      expect(result.status).toBe('ACCEPTED');
      expect(mockKnex.transaction).toHaveBeenCalled();
      expect(builders.quotes.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACCEPTED' }),
      );
      expect(builders.quotes.where).toHaveBeenCalledWith({
        order_id: ORDER_ID,
        status: 'PENDING',
      });
      expect(builders.orders.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACCEPTED' }),
      );
      expect(builders.transactions.insert).toHaveBeenCalledWith({
        order_id: ORDER_ID,
        payer_id: CLIENT_USER_ID,
        receiver_id: WORKER_USER_ID,
        amount: '35000.00',
        status: 'PENDING',
      });
    });
  });

  describe('deleteQuote', () => {
    it('should return QUOTE_NOT_FOUND when the quote does not exist', async () => {
      const result = await quoteService.deleteQuote(QUOTE_ID, WORKER_USER_ID);
      expect(result).toEqual({ error: 'QUOTE_NOT_FOUND' });
    });

    it('should return FORBIDDEN when the user is not the order worker', async () => {
      builders['quotes as q'] = makeBuilder();
      builders['quotes as q'].first.mockResolvedValue(QUOTE_ROW_WITH_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(null);

      const result = await quoteService.deleteQuote(QUOTE_ID, CLIENT_USER_ID);
      expect(result).toEqual({ error: 'FORBIDDEN' });
    });

    it('should return QUOTE_NOT_PENDING when the quote is already accepted', async () => {
      builders['quotes as q'] = makeBuilder();
      builders['quotes as q'].first.mockResolvedValue({
        ...QUOTE_ROW_WITH_ORDER,
        status: 'ACCEPTED',
      });
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const result = await quoteService.deleteQuote(QUOTE_ID, WORKER_USER_ID);
      expect(result).toEqual({ error: 'QUOTE_NOT_PENDING' });
    });

    it('should delete a pending quote', async () => {
      builders['quotes as q'] = makeBuilder();
      builders['quotes as q'].first.mockResolvedValue(QUOTE_ROW_WITH_ORDER);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.quotes = makeBuilder();
      builders.quotes.del.mockResolvedValue(1);

      const result = await quoteService.deleteQuote(QUOTE_ID, WORKER_USER_ID);
      expect(result).toBe(true);
      expect(builders.quotes.del).toHaveBeenCalled();
    });
  });
});

describe('QuoteController', () => {
  beforeEach(resetBuilders);

  const buildReq = (params, body, user) => ({ params, body, user });

  describe('create validation', () => {
    it('should reject a non-positive price', () => {
      const { error } = createQuoteSchema.validate({
        proposed_price: 0,
        proposed_date: '2099-01-01',
        proposed_time: '10:00',
      });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('positivo');
    });

    it('should reject a past date', () => {
      const { error } = createQuoteSchema.validate({
        proposed_price: 100,
        proposed_date: '2020-01-01',
        proposed_time: '10:00',
      });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('fecha');
    });

    it("should accept today's date (timezone-safe)", () => {
      const today = new Date();
      const todayStr = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-');
      const { error } = createQuoteSchema.validate({
        proposed_price: 100,
        proposed_date: todayStr,
        proposed_time: '10:00',
      });
      expect(error).toBeUndefined();
    });

    it('should reject an invalid time', () => {
      const { error } = createQuoteSchema.validate({
        proposed_price: 100,
        proposed_date: '2099-01-01',
        proposed_time: '25:99',
      });
      expect(error).toBeDefined();
    });
  });

  describe('update status validation', () => {
    it('should reject an unknown status', () => {
      const { error } = updateQuoteStatusSchema.validate({ status: 'DECLINED' });
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('ACCEPTED');
    });

    it('should accept an optional rejection reason', () => {
      const { value } = updateQuoteStatusSchema.validate({
        status: 'REJECTED',
        rejection_reason: 'Muy caro',
      });
      expect(value.status).toBe('REJECTED');
      expect(value.rejection_reason).toBe('Muy caro');
    });
  });

  describe('create controller', () => {
    it('should return 400 VALIDATION_ERROR for invalid body', async () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const req = buildReq(
        { order_id: ORDER_ID },
        { proposed_price: -5 },
        { user_id: WORKER_USER_ID },
      );

      await quoteController.create(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR' }));
    });

    it('should return 201 with the created quote', async () => {
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW);
      builders.quotes = makeBuilder();
      builders.quotes.returning.mockResolvedValue([QUOTE_ROW]);

      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const req = buildReq(
        { order_id: ORDER_ID },
        {
          proposed_price: 35000,
          proposed_date: '2026-08-20',
          proposed_time: '14:30',
        },
        { user_id: WORKER_USER_ID },
      );

      await quoteController.create(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Cotización creada correctamente' }),
      );
    });
  });
});
