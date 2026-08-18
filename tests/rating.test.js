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

const { default: ratingService } = await import('../src/services/RatingService.js');
const { default: ratingController } = await import('../src/controllers/RatingController.js');

const CLIENT_USER_ID = '11111111-1111-1111-1111-111111111111';
const WORKER_USER_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_USER_ID = '99999999-9999-9999-9999-999999999999';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';
const CLIENT_PROFILE_ID = '55555555-5555-5555-5555-555555555555';
const WORKER_PROFILE_ID = '66666666-6666-6666-6666-666666666666';
const RATING_ID = '77777777-7777-7777-7777-777777777777';

const COMPLETED_ORDER = {
  id: ORDER_ID,
  client_id: CLIENT_PROFILE_ID,
  worker_id: WORKER_PROFILE_ID,
  status: 'COMPLETED',
};

const CLIENT_PROFILE_ROW = { id: CLIENT_PROFILE_ID, user_id: CLIENT_USER_ID };
const WORKER_PROFILE_ROW = { id: WORKER_PROFILE_ID, user_id: WORKER_USER_ID };

const CREATED_RATING = {
  id: RATING_ID,
  order_id: ORDER_ID,
  rater_id: CLIENT_USER_ID,
  ratee_id: WORKER_USER_ID,
  rating_stars: 5,
  review_text: 'Excelente trabajo',
  created_at: new Date(),
};

const resetBuilders = () => {
  Object.keys(builders).forEach((key) => delete builders[key]);
  setupMockKnex();
};

describe('RatingService', () => {
  beforeEach(resetBuilders);

  describe('createRating', () => {
    it('should return ORDER_NOT_FOUND if order does not exist', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(null);

      const res = await ratingService.createRating(CLIENT_USER_ID, {
        order_id: ORDER_ID,
        rating_stars: 5,
      });
      expect(res.error).toBe('ORDER_NOT_FOUND');
    });

    it('should return ORDER_NOT_COMPLETED if order is not COMPLETED', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue({ ...COMPLETED_ORDER, status: 'PENDING' });

      const res = await ratingService.createRating(CLIENT_USER_ID, {
        order_id: ORDER_ID,
        rating_stars: 5,
      });
      expect(res.error).toBe('ORDER_NOT_COMPLETED');
    });

    it('should return FORBIDDEN if user is not a participant', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(COMPLETED_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);

      const res = await ratingService.createRating(OTHER_USER_ID, {
        order_id: ORDER_ID,
        rating_stars: 5,
      });
      expect(res.error).toBe('FORBIDDEN');
    });

    it('should return ALREADY_RATED if user already rated this order', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(COMPLETED_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.ratings = makeBuilder();
      builders.ratings.first.mockResolvedValue({ id: 'existing-rating' });

      const res = await ratingService.createRating(CLIENT_USER_ID, {
        order_id: ORDER_ID,
        rating_stars: 5,
      });
      expect(res.error).toBe('ALREADY_RATED');
    });

    it('should create a rating with correct ratee determination (client rates worker)', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(COMPLETED_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.ratings = makeBuilder();
      builders.ratings.first.mockResolvedValue(null); // no existing rating
      builders.ratings.returning.mockResolvedValue([CREATED_RATING]);
      builders.users = makeBuilder();

      const res = await ratingService.createRating(CLIENT_USER_ID, {
        order_id: ORDER_ID,
        rating_stars: 5,
        review_text: 'Excelente trabajo',
      });

      expect(res.error).toBeUndefined();
      expect(res.rater_id).toBe(CLIENT_USER_ID);
      expect(res.ratee_id).toBe(WORKER_USER_ID);
      expect(res.rating_stars).toBe(5);
      expect(res.review_text).toBe('Excelente trabajo');
    });

    it('should create a rating with correct ratee determination (worker rates client)', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(COMPLETED_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.ratings = makeBuilder();
      builders.ratings.first.mockResolvedValue(null);
      const workerRating = {
        ...CREATED_RATING,
        rater_id: WORKER_USER_ID,
        ratee_id: CLIENT_USER_ID,
        rating_stars: 4,
      };
      builders.ratings.returning.mockResolvedValue([workerRating]);
      builders.users = makeBuilder();

      const res = await ratingService.createRating(WORKER_USER_ID, {
        order_id: ORDER_ID,
        rating_stars: 4,
      });

      expect(res.error).toBeUndefined();
      expect(res.rater_id).toBe(WORKER_USER_ID);
      expect(res.ratee_id).toBe(CLIENT_USER_ID);
      expect(res.rating_stars).toBe(4);
    });

    it('should update average_rating on worker_profiles after creating rating', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(COMPLETED_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.ratings = makeBuilder();
      builders.ratings.first.mockResolvedValue(null);
      builders.ratings.returning.mockResolvedValue([CREATED_RATING]);
      builders.users = makeBuilder();
      builders['ratings as r'] = builders.ratings;

      await ratingService.createRating(CLIENT_USER_ID, {
        order_id: ORDER_ID,
        rating_stars: 5,
      });

      expect(builders.worker_profiles.update).toHaveBeenCalled();
    });
  });

  describe('listRatingsByUser', () => {
    it('should return empty result if user has no ratings', async () => {
      builders.ratings = makeBuilder();
      builders.ratings.count.mockResolvedValue([{ count: 0 }]);
      builders.ratings.offset.mockResolvedValue([]);

      const res = await ratingService.listRatingsByUser(OTHER_USER_ID, { limit: 20, offset: 0 });
      expect(res.ratings).toEqual([]);
      expect(res.count).toBe(0);
    });

    it('should return ratings with rater info', async () => {
      const row = {
        ...CREATED_RATING,
        rater_full_name: 'Juan Pérez',
        rater_avatar_url: null,
      };
      builders.ratings = makeBuilder();
      builders.ratings.count.mockResolvedValue([{ count: 1 }]);
      builders['ratings as r'] = makeBuilder();
      builders['ratings as r'].offset.mockResolvedValue([row]);

      const res = await ratingService.listRatingsByUser(WORKER_USER_ID, { limit: 20, offset: 0 });
      expect(res.ratings).toHaveLength(1);
      expect(res.ratings[0].rater.full_name).toBe('Juan Pérez');
      expect(res.count).toBe(1);
    });
  });

  describe('getRatingAverage', () => {
    it('should return null average when no ratings exist', async () => {
      builders.ratings = makeBuilder();
      builders.ratings.first.mockResolvedValue({ average: null, total_ratings: 0 });

      const res = await ratingService.getRatingAverage(OTHER_USER_ID);
      expect(res.average_rating).toBeNull();
      expect(res.total_ratings).toBe(0);
    });

    it('should return calculated average and total', async () => {
      builders.ratings = makeBuilder();
      builders.ratings.first.mockResolvedValue({ average: '4.50', total_ratings: 10 });

      const res = await ratingService.getRatingAverage(WORKER_USER_ID);
      expect(res.average_rating).toBe(4.5);
      expect(res.total_ratings).toBe(10);
    });
  });
});

describe('RatingController', () => {
  beforeEach(resetBuilders);

  describe('create', () => {
    it('should return 400 on validation error', async () => {
      const req = {
        user: { user_id: CLIENT_USER_ID },
        body: {},
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await ratingController.create(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR' }));
    });

    it('should return 201 on successful rating creation', async () => {
      builders.orders = makeBuilder();
      builders.orders.first.mockResolvedValue(COMPLETED_ORDER);
      builders.client_profiles = makeBuilder();
      builders.client_profiles.first.mockResolvedValue(CLIENT_PROFILE_ROW);
      builders.worker_profiles = makeBuilder();
      builders.worker_profiles.first.mockResolvedValue(WORKER_PROFILE_ROW);
      builders.ratings = makeBuilder();
      builders.ratings.first.mockResolvedValue(null);
      builders.ratings.returning.mockResolvedValue([CREATED_RATING]);
      builders.users = makeBuilder();

      const req = {
        user: { user_id: CLIENT_USER_ID },
        body: { order_id: ORDER_ID, rating_stars: 5, review_text: 'Excelente trabajo' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await ratingController.create(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Calificación creada correctamente' }),
      );
    });
  });

  describe('listByUser', () => {
    it('should return 200 with paginated ratings', async () => {
      builders.ratings = makeBuilder();
      builders.ratings.count.mockResolvedValue([{ count: 0 }]);
      builders.ratings.offset.mockResolvedValue([]);

      const req = {
        params: { id: WORKER_USER_ID },
        query: {},
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await ratingController.listByUser(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 0, ratings: [] }));
    });
  });

  describe('getAverage', () => {
    it('should return 200 with average', async () => {
      builders.ratings = makeBuilder();
      builders.ratings.first.mockResolvedValue({ average: '4.00', total_ratings: 5 });

      const req = {
        params: { id: WORKER_USER_ID },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await ratingController.getAverage(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ average_rating: 4.0, total_ratings: 5 }),
      );
    });
  });
});
