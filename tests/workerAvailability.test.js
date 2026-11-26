import { jest } from '@jest/globals';

const builders = {};

const makeBuilder = () => {
  const builder = {
    where: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    count: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue([]),
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
  mockKnex.raw = jest.fn((val) => val);
  mockKnex.fn = { now: () => new Date() };
};

setupMockKnex();

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));

const { default: availabilityService } =
  await import('../src/services/WorkerAvailabilityService.js');
const { default: availabilityController } =
  await import('../src/controllers/WorkerAvailabilityController.js');

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '99999999-9999-9999-9999-999999999999';
const WORKER_PROFILE_ID = '22222222-2222-2222-2222-222222222222';
const AVAILABILITY_ID = '33333333-3333-3333-3333-333333333333';

const WORKER_PROFILE_ROW = { id: WORKER_PROFILE_ID, user_id: USER_ID };

const AVAILABILITY_ROW = {
  id: AVAILABILITY_ID,
  worker_id: WORKER_PROFILE_ID,
  day_of_week: 1,
  start_time: '09:00',
  end_time: '13:00',
  created_at: new Date(),
  updated_at: new Date(),
};

const resetBuilders = () => {
  Object.keys(builders).forEach((key) => delete builders[key]);
  setupMockKnex();
};

describe('WorkerAvailabilityService', () => {
  describe('createAvailability', () => {
    it('debería retornar WORKER_PROFILE_NOT_FOUND si el perfil no existe o no pertenece al usuario', async () => {
      resetBuilders();
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(null);

      const res = await availabilityService.createAvailability(WORKER_PROFILE_ID, USER_ID, {
        day_of_week: 1,
        start_time: '09:00',
        end_time: '13:00',
      });

      expect(res.error).toBe('WORKER_PROFILE_NOT_FOUND');
    });

    it('debería retornar DAILY_LIMIT_REACHED si ya hay 2 rangos para el día', async () => {
      resetBuilders();
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.worker_availability = makeBuilder();
      builders.worker_availability.count.mockResolvedValue([{ total: 2 }]);

      const res = await availabilityService.createAvailability(WORKER_PROFILE_ID, USER_ID, {
        day_of_week: 1,
        start_time: '09:00',
        end_time: '13:00',
      });

      expect(res.error).toBe('DAILY_LIMIT_REACHED');
    });

    it('debería crear la disponibilidad si pasa todas las validaciones', async () => {
      resetBuilders();
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.worker_availability = makeBuilder();
      builders.worker_availability.count.mockResolvedValue([{ total: 0 }]);
      builders.worker_availability.returning.mockResolvedValue([AVAILABILITY_ROW]);

      const res = await availabilityService.createAvailability(WORKER_PROFILE_ID, USER_ID, {
        day_of_week: 1,
        start_time: '09:00',
        end_time: '13:00',
      });

      expect(res.error).toBeUndefined();
      expect(res.day_of_week).toBe(1);
      expect(res.start_time).toBe('09:00');
      expect(res.end_time).toBe('13:00');
    });
  });

  describe('listAvailability', () => {
    it('debería retornar WORKER_PROFILE_NOT_FOUND si el perfil no pertenece al usuario', async () => {
      resetBuilders();
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(null);

      const res = await availabilityService.listAvailability(WORKER_PROFILE_ID, OTHER_USER_ID);

      expect(res.error).toBe('WORKER_PROFILE_NOT_FOUND');
    });

    it('debería listar los rangos de disponibilidad del trabajador', async () => {
      resetBuilders();
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.worker_availability = makeBuilder();
      builders.worker_availability.orderBy.mockResolvedValue([AVAILABILITY_ROW]);

      const res = await availabilityService.listAvailability(WORKER_PROFILE_ID, USER_ID);

      expect(Array.isArray(res)).toBe(true);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(AVAILABILITY_ID);
    });
  });

  describe('updateAvailability', () => {
    it('debería retornar AVAILABILITY_NOT_FOUND si la disponibilidad no existe', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first.mockResolvedValue(null);

      const res = await availabilityService.updateAvailability(AVAILABILITY_ID, USER_ID, {
        end_time: '14:00',
      });

      expect(res.error).toBe('AVAILABILITY_NOT_FOUND');
    });

    it('debería retornar AVAILABILITY_NOT_FOUND si el usuario no es dueño del trabajador', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first.mockResolvedValue(AVAILABILITY_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(null);

      const res = await availabilityService.updateAvailability(AVAILABILITY_ID, OTHER_USER_ID, {
        end_time: '14:00',
      });

      expect(res.error).toBe('AVAILABILITY_NOT_FOUND');
    });

    it('debería retornar INVALID_TIME_RANGE si el nuevo rango queda invertido', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first.mockResolvedValue(AVAILABILITY_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const res = await availabilityService.updateAvailability(AVAILABILITY_ID, USER_ID, {
        end_time: '08:00',
      });

      expect(res.error).toBe('INVALID_TIME_RANGE');
    });

    it('debería retornar DAILY_LIMIT_REACHED si se mueve a un día con 2 rangos', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first.mockResolvedValue(AVAILABILITY_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.worker_availability.count.mockResolvedValue([{ total: 2 }]);

      const res = await availabilityService.updateAvailability(AVAILABILITY_ID, USER_ID, {
        day_of_week: 3,
      });

      expect(res.error).toBe('DAILY_LIMIT_REACHED');
    });

    it('debería actualizar el rango de disponibilidad correctamente', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first
        .mockResolvedValueOnce(AVAILABILITY_ROW)
        .mockResolvedValueOnce({ ...AVAILABILITY_ROW, end_time: '14:00' });
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const res = await availabilityService.updateAvailability(AVAILABILITY_ID, USER_ID, {
        end_time: '14:00',
      });

      expect(res.error).toBeUndefined();
      expect(res.end_time).toBe('14:00');
    });
  });

  describe('deleteAvailability', () => {
    it('debería retornar AVAILABILITY_NOT_FOUND si la disponibilidad no existe', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first.mockResolvedValue(null);

      const res = await availabilityService.deleteAvailability(AVAILABILITY_ID, USER_ID);

      expect(res.error).toBe('AVAILABILITY_NOT_FOUND');
    });

    it('debería retornar AVAILABILITY_NOT_FOUND si el usuario no es dueño del trabajador', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first.mockResolvedValue(AVAILABILITY_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(null);

      const res = await availabilityService.deleteAvailability(AVAILABILITY_ID, OTHER_USER_ID);

      expect(res.error).toBe('AVAILABILITY_NOT_FOUND');
    });

    it('debería eliminar la disponibilidad correctamente', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first.mockResolvedValue(AVAILABILITY_ROW);
      builders.worker_availability.del.mockResolvedValue(1);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const res = await availabilityService.deleteAvailability(AVAILABILITY_ID, USER_ID);

      expect(res.deleted).toBe(true);
    });
  });
});

describe('WorkerAvailabilityController', () => {
  const mockRequest = (params, body, user) => ({
    params,
    body,
    user,
  });

  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  describe('create', () => {
    it('debería responder 201 al crear disponibilidad correctamente', async () => {
      resetBuilders();
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.worker_availability = makeBuilder();
      builders.worker_availability.count.mockResolvedValue([{ total: 0 }]);
      builders.worker_availability.returning.mockResolvedValue([AVAILABILITY_ROW]);

      const req = mockRequest(
        { id: WORKER_PROFILE_ID },
        { day_of_week: 1, start_time: '09:00', end_time: '13:00' },
        { user_id: USER_ID },
      );
      const res = mockResponse();

      await availabilityController.create(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Disponibilidad creada correctamente' }),
      );
    });

    it('debería responder 400 ante validación fallida', async () => {
      const req = mockRequest(
        { id: WORKER_PROFILE_ID },
        { day_of_week: 7, start_time: '09:00', end_time: '08:00' },
        { user_id: USER_ID },
      );
      const res = mockResponse();

      await availabilityController.create(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR' }));
    });

    it('debería responder 409 si se supera el máximo de rangos por día', async () => {
      resetBuilders();
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.worker_availability = makeBuilder();
      builders.worker_availability.count.mockResolvedValue([{ total: 2 }]);

      const req = mockRequest(
        { id: WORKER_PROFILE_ID },
        { day_of_week: 1, start_time: '09:00', end_time: '13:00' },
        { user_id: USER_ID },
      );
      const res = mockResponse();

      await availabilityController.create(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'DAILY_LIMIT_REACHED' }),
      );
    });

    it('debería responder 404 si el perfil de trabajador no existe', async () => {
      resetBuilders();
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(null);

      const req = mockRequest(
        { id: WORKER_PROFILE_ID },
        { day_of_week: 1, start_time: '09:00', end_time: '13:00' },
        { user_id: USER_ID },
      );
      const res = mockResponse();

      await availabilityController.create(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'WORKER_PROFILE_NOT_FOUND' }),
      );
    });
  });

  describe('list', () => {
    it('debería responder 200 con la lista de disponibilidad', async () => {
      resetBuilders();
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.worker_availability = makeBuilder();
      builders.worker_availability.orderBy.mockResolvedValue([AVAILABILITY_ROW]);

      const req = mockRequest({ id: WORKER_PROFILE_ID }, {}, { user_id: USER_ID });
      const res = mockResponse();

      await availabilityController.list(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
    });
  });

  describe('update', () => {
    it('debería responder 200 al actualizar correctamente', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first
        .mockResolvedValueOnce(AVAILABILITY_ROW)
        .mockResolvedValueOnce({ ...AVAILABILITY_ROW, end_time: '14:00' });
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const req = mockRequest({ id: AVAILABILITY_ID }, { end_time: '14:00' }, { user_id: USER_ID });
      const res = mockResponse();

      await availabilityController.update(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Disponibilidad actualizada correctamente' }),
      );
    });

    it('debería responder 400 si el rango queda invertido', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first.mockResolvedValue(AVAILABILITY_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const req = mockRequest({ id: AVAILABILITY_ID }, { end_time: '08:00' }, { user_id: USER_ID });
      const res = mockResponse();

      await availabilityController.update(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'INVALID_TIME_RANGE' }),
      );
    });

    it('debería responder 404 si la disponibilidad no existe', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first.mockResolvedValue(null);

      const req = mockRequest({ id: AVAILABILITY_ID }, { end_time: '14:00' }, { user_id: USER_ID });
      const res = mockResponse();

      await availabilityController.update(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'AVAILABILITY_NOT_FOUND' }),
      );
    });
  });

  describe('remove', () => {
    it('debería responder 200 al eliminar correctamente', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first.mockResolvedValue(AVAILABILITY_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const req = mockRequest({ id: AVAILABILITY_ID }, {}, { user_id: USER_ID });
      const res = mockResponse();

      await availabilityController.remove(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Disponibilidad eliminada correctamente' }),
      );
    });

    it('debería responder 404 si la disponibilidad no existe', async () => {
      resetBuilders();
      builders.worker_availability = makeBuilder();
      builders.worker_availability.first.mockResolvedValue(null);

      const req = mockRequest({ id: AVAILABILITY_ID }, {}, { user_id: USER_ID });
      const res = mockResponse();

      await availabilityController.remove(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'AVAILABILITY_NOT_FOUND' }),
      );
    });
  });
});
