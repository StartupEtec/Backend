import { jest } from '@jest/globals';

const orderServiceMock = {
  createOrder: jest.fn(),
  listUserOrders: jest.fn(),
  getOrderById: jest.fn(),
  updateOrderStatus: jest.fn(),
  getOrderHistory: jest.fn(),
  completeOrder: jest.fn(),
};

jest.unstable_mockModule('../src/services/OrderService.js', () => ({
  default: orderServiceMock,
}));

const { default: orderController } = await import('../src/controllers/OrderController.js');

const CLIENT_USER_ID = '11111111-1111-1111-1111-111111111111';
const WORKER_USER_ID = '22222222-2222-2222-2222-222222222222';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('OrderController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should return 400 if validation fails', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        body: {},
      };
      const res = buildRes();
      const next = jest.fn();

      // Force the validation schema error path by passing invalid input
      req.body = { client_id: 'not-a-uuid', worker_id: 'not-a-uuid' };

      await orderController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 400 if client and worker are the same user (validation)', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        body: {
          client_id: CLIENT_USER_ID,
          worker_id: CLIENT_USER_ID,
          category_id: 'cat-id',
          location_id: 'loc-id',
        },
      };
      const res = buildRes();
      const next = jest.fn();

      await orderController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 201 when order service succeeds', async () => {
      const body = {
        client_id: CLIENT_USER_ID,
        worker_id: WORKER_USER_ID,
        category_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        location_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        description: 'Reparar fuga',
      };
      const req = {
        user: { user_id: CLIENT_USER_ID },
        body,
      };
      const res = buildRes();
      const next = jest.fn();

      orderServiceMock.createOrder.mockResolvedValue({
        id: 'order-uuid',
        status: 'PENDING',
      });

      await orderController.create(req, res, next);

      expect(orderServiceMock.createOrder).toHaveBeenCalledWith(
        CLIENT_USER_ID,
        expect.objectContaining({ client_id: CLIENT_USER_ID }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Orden creada correctamente',
          order: expect.objectContaining({ id: 'order-uuid' }),
        }),
      );
    });

    it('should map CLIENT_PROFILE_REQUIRED to 400', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        body: {
          client_id: CLIENT_USER_ID,
          worker_id: WORKER_USER_ID,
          category_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          location_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        },
      };
      const res = buildRes();
      const next = jest.fn();

      orderServiceMock.createOrder.mockResolvedValue({
        error: 'CLIENT_PROFILE_REQUIRED',
        message: 'Debes tener un perfil de cliente',
      });

      await orderController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should map WORKER_NOT_FOUND / CATEGORY_NOT_FOUND / LOCATION_NOT_FOUND to 404', async () => {
      const cases = ['WORKER_NOT_FOUND', 'CATEGORY_NOT_FOUND', 'LOCATION_NOT_FOUND'];
      for (const error of cases) {
        const req = {
          user: { user_id: CLIENT_USER_ID },
          body: {
            client_id: CLIENT_USER_ID,
            worker_id: WORKER_USER_ID,
            category_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            location_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          },
        };
        const res = buildRes();
        const next = jest.fn();

        orderServiceMock.createOrder.mockResolvedValue({ error, message: 'x' });

        await orderController.create(req, res, next);
        expect(res.status).toHaveBeenCalledWith(404);
      }
    });
  });

  describe('listUserOrders', () => {
    it('should return 403 if requested user_id does not match token', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        params: { id: WORKER_USER_ID },
        query: {},
      };
      const res = buildRes();
      const next = jest.fn();

      await orderController.listUserOrders(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 if query validation fails', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        params: { id: CLIENT_USER_ID },
        query: { limit: 'invalid' },
      };
      const res = buildRes();
      const next = jest.fn();

      await orderController.listUserOrders(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 200 with orders when validation passes', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        params: { id: CLIENT_USER_ID },
        query: { limit: 20, offset: 0 },
      };
      const res = buildRes();
      const next = jest.fn();

      orderServiceMock.listUserOrders.mockResolvedValue({
        orders: [{ id: 'order-uuid' }],
        count: 1,
        limit: 20,
        offset: 0,
      });

      await orderController.listUserOrders(req, res, next);

      expect(orderServiceMock.listUserOrders).toHaveBeenCalledWith(
        CLIENT_USER_ID,
        expect.objectContaining({ limit: 20, offset: 0 }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('complete', () => {
    it('should return 400 if validation fails', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        params: { id: ORDER_ID },
        body: { confirm: 'not-a-boolean' },
      };
      const res = buildRes();
      const next = jest.fn();

      await orderController.complete(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 404 if order not found', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        params: { id: ORDER_ID },
        body: {},
      };
      const res = buildRes();
      const next = jest.fn();

      orderServiceMock.completeOrder.mockResolvedValue({
        error: 'ORDER_NOT_FOUND',
      });

      await orderController.complete(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if user not participant', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        params: { id: ORDER_ID },
        body: {},
      };
      const res = buildRes();
      const next = jest.fn();

      orderServiceMock.completeOrder.mockResolvedValue({
        error: 'FORBIDDEN',
      });

      await orderController.complete(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 409 if invalid transition', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        params: { id: ORDER_ID },
        body: {},
      };
      const res = buildRes();
      const next = jest.fn();

      orderServiceMock.completeOrder.mockResolvedValue({
        error: 'INVALID_TRANSITION',
        message: 'Orden no está en IN_PROGRESS',
      });

      await orderController.complete(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should return 409 if already confirmed', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        params: { id: ORDER_ID },
        body: {},
      };
      const res = buildRes();
      const next = jest.fn();

      orderServiceMock.completeOrder.mockResolvedValue({
        error: 'ALREADY_CONFIRMED',
        message: 'El cliente ya confirmó la finalización',
      });

      await orderController.complete(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should return 200 when confirmation recorded but both not confirmed', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        params: { id: ORDER_ID },
        body: { confirm: true },
      };
      const res = buildRes();
      const next = jest.fn();

      orderServiceMock.completeOrder.mockResolvedValue({
        order: { id: ORDER_ID, status: 'IN_PROGRESS' },
        bothConfirmed: false,
        clientConfirmed: true,
        workerConfirmed: false,
      });

      await orderController.complete(req, res, next);

      expect(orderServiceMock.completeOrder).toHaveBeenCalledWith(ORDER_ID, CLIENT_USER_ID, {
        confirm: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Confirmación registrada. Se requiere la confirmación de ambas partes',
          bothConfirmed: false,
        }),
      );
    });

    it('should return 200 with completion message when both confirmed', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        params: { id: ORDER_ID },
        body: { confirm: true },
      };
      const res = buildRes();
      const next = jest.fn();

      orderServiceMock.completeOrder.mockResolvedValue({
        order: { id: ORDER_ID, status: 'COMPLETED' },
        bothConfirmed: true,
        clientConfirmed: true,
        workerConfirmed: true,
      });

      await orderController.complete(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Servicio completado y escrow liberado',
          bothConfirmed: true,
        }),
      );
    });
  });
});
