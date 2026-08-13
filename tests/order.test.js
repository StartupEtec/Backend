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
    returning: jest.fn().mockResolvedValue([{ id: 'event-uuid' }]),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue([]),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue([]),
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
jest.unstable_mockModule('../src/utils/websocket.js', () => ({
  default: {
    sendToUsers: jest.fn(),
  },
}));

const { default: orderService } = await import('../src/services/OrderService.js');
const { default: orderController } = await import('../src/controllers/OrderController.js');

const CLIENT_USER_ID = '11111111-1111-1111-1111-111111111111';
const WORKER_USER_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_USER_ID = '99999999-9999-9999-9999-999999999999';

const ORDER_ID = '33333333-3333-3333-3333-333333333333';
const CLIENT_PROFILE_ID = '55555555-5555-5555-5555-555555555555';
const WORKER_PROFILE_ID = '66666666-6666-6666-6666-666666666666';

const ORDER_ROW = {
  id: ORDER_ID,
  client_id: CLIENT_PROFILE_ID,
  worker_id: WORKER_PROFILE_ID,
  category_id: 'cat-id',
  location_id: 'loc-id',
  status: 'PENDING',
  created_at: new Date(),
  updated_at: new Date(),
};

const CLIENT_PROFILE_ROW = { id: CLIENT_PROFILE_ID, user_id: CLIENT_USER_ID };
const WORKER_PROFILE_ROW = { id: WORKER_PROFILE_ID, user_id: WORKER_USER_ID };

const resetBuilders = () => {
  Object.keys(builders).forEach((key) => delete builders[key]);
  setupMockKnex();
};

describe('OrderService', () => {
  beforeEach(resetBuilders);

  describe('getOrderById', () => {
    it('should return null if order does not exist', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(null);

      const order = await orderService.getOrderById(ORDER_ID, CLIENT_USER_ID);
      expect(order).toBeNull();
    });

    it('should return null if user is not a participant', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(null);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(null);

      const order = await orderService.getOrderById(ORDER_ID, OTHER_USER_ID);
      expect(order).toBeNull();
    });

    it('should return order if user is client', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(null);

      const order = await orderService.getOrderById(ORDER_ID, CLIENT_USER_ID);
      expect(order).not.toBeNull();
      expect(order.id).toBe(ORDER_ID);
    });
  });

  describe('updateOrderStatus', () => {
    it('should return ORDER_NOT_FOUND if order does not exist', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(null);

      const res = await orderService.updateOrderStatus(ORDER_ID, CLIENT_USER_ID, 'ACCEPTED');
      expect(res).toEqual({ error: 'ORDER_NOT_FOUND' });
    });

    it('should return FORBIDDEN if user is not order client/worker', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const res = await orderService.updateOrderStatus(ORDER_ID, OTHER_USER_ID, 'ACCEPTED');
      expect(res).toEqual({ error: 'FORBIDDEN' });
    });

    it('should return INVALID_TRANSITION if transition is not allowed', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW); // PENDING
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const res = await orderService.updateOrderStatus(ORDER_ID, CLIENT_USER_ID, 'COMPLETED'); // PENDING -> COMPLETED
      expect(res.error).toBe('INVALID_TRANSITION');
    });

    it('should successfully transition PENDING -> ACCEPTED for Client', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.order_events = makeBuilder();

      const res = await orderService.updateOrderStatus(ORDER_ID, CLIENT_USER_ID, 'ACCEPTED');
      expect(res.error).toBeUndefined();
      expect(res.order).toBeDefined();
    });

    it('should return FORBIDDEN if Worker tries to transition PENDING -> ACCEPTED', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const res = await orderService.updateOrderStatus(ORDER_ID, WORKER_USER_ID, 'ACCEPTED');
      expect(res.error).toBe('FORBIDDEN');
    });

    it('should successfully transition ACCEPTED -> IN_PROGRESS for Worker', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue({ ...ORDER_ROW, status: 'ACCEPTED' });
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.order_events = makeBuilder();

      const res = await orderService.updateOrderStatus(ORDER_ID, WORKER_USER_ID, 'IN_PROGRESS');
      expect(res.error).toBeUndefined();
      expect(res.order).toBeDefined();
    });
  });

  describe('getOrderHistory', () => {
    it('should retrieve events if user is participant', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(ORDER_ROW);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      builders.order_events = makeBuilder();
      builders.order_events.orderBy.mockResolvedValue([
        { id: '1', order_id: ORDER_ID, from_state: 'PENDING', to_state: 'ACCEPTED' },
      ]);

      const res = await orderService.getOrderHistory(ORDER_ID, CLIENT_USER_ID);
      expect(res.error).toBeUndefined();
      expect(res.events).toHaveLength(1);
    });
  });
});
