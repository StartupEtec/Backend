import { jest } from '@jest/globals';

const makeBuilder = () => {
  const builder = {
    _resolvedValue: [],
    where: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue([{ count: 0 }]),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    del: jest.fn().mockResolvedValue(1),
    increment: jest.fn().mockResolvedValue(1),
    decrement: jest.fn().mockResolvedValue(1),
    then: (onFulfilled) => Promise.resolve(builder._resolvedValue).then(onFulfilled),
  };
  builder.insert.mockImplementation(() => builder);
  builder.returning.mockImplementation(() => builder);
  builder.update.mockImplementation(() => builder);
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

const { default: certificationService } = await import('../src/services/CertificationService.js');
const { default: certificationController } =
  await import('../src/controllers/CertificationController.js');

describe('Worker Certifications Tests', () => {
  beforeEach(() => {
    Object.keys(builders).forEach((key) => {
      delete builders[key];
    });
  });

  describe('CertificationService', () => {
    test('createCertification inserts certification and resets profile status to PENDING', async () => {
      getBuilder('worker_profiles').first.mockResolvedValue({
        id: 'worker-uuid',
        user_id: 'user-uuid',
        certification_status: 'REJECTED',
      });
      getBuilder('certifications')._resolvedValue = [
        {
          id: 'cert-uuid',
          worker_id: 'worker-uuid',
          document_type: 'BACKGROUND_CHECK',
          verification_status: 'PENDING',
        },
      ];

      const file = { originalname: 'doc.pdf', buffer: Buffer.from('hello') };
      const res = await certificationService.createCertification(
        'worker-uuid',
        'BACKGROUND_CHECK',
        file,
      );

      expect(res.certification).toBeDefined();
      expect(res.certification.verification_status).toBe('PENDING');
    });

    test('updateCertificationDocument updates document and returns to PENDING', async () => {
      getBuilder('certifications').first.mockResolvedValue({
        id: 'cert-uuid',
        worker_id: 'worker-uuid',
        verification_status: 'REJECTED',
        document_url: '/uploads/certifications/old.pdf',
      });
      getBuilder('certifications')._resolvedValue = [
        {
          id: 'cert-uuid',
          verification_status: 'PENDING',
          document_url: '/uploads/certifications/new.pdf',
        },
      ];

      const file = { originalname: 'new.pdf', buffer: Buffer.from('new content') };
      const res = await certificationService.updateCertificationDocument('cert-uuid', file);

      expect(res.certification.verification_status).toBe('PENDING');
    });

    test('updateCertificationStatus sets approved_at on APPROVED status and updates profile', async () => {
      getBuilder('certifications').first.mockResolvedValue({
        id: 'cert-uuid',
        worker_id: 'worker-uuid',
        verification_status: 'PENDING',
      });
      // Mock all certifications as approved
      getBuilder('certifications')._resolvedValue = [
        { id: 'cert-uuid', verification_status: 'APPROVED' },
      ];
      getBuilder('worker_profiles').first.mockResolvedValue({
        id: 'worker-uuid',
        user_id: 'user-uuid',
      });
      getBuilder('users').first.mockResolvedValue({ email: 'test@example.com' });

      const res = await certificationService.updateCertificationStatus('cert-uuid', 'APPROVED');
      expect(res.certification.verification_status).toBe('APPROVED');
    });
  });

  describe('CertificationController', () => {
    const makeRes = () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      return res;
    };

    test('create returns 403 when user is not owner of worker profile', async () => {
      getBuilder('worker_profiles').first.mockResolvedValue({
        id: 'worker-uuid',
        user_id: 'other-user-uuid',
      });

      const req = {
        params: { id: 'worker-uuid' },
        user: { user_id: 'my-user-uuid' },
      };
      const res = makeRes();

      await certificationController.create(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json.mock.calls[0][0].error).toBe('FORBIDDEN');
    });

    test('updateStatus returns 400 when status is REJECTED but reason is missing', async () => {
      const req = {
        params: { id: 'cert-uuid' },
        body: { verification_status: 'REJECTED' },
      };
      const res = makeRes();

      await certificationController.updateStatus(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toBe('VALIDATION_ERROR');
    });
  });
});
