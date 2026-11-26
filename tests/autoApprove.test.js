import { jest } from '@jest/globals';

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([]),
};

const mockKnex = Object.assign(() => mockQueryBuilder, {
  fn: { now: () => new Date() },
});

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));

const {
  isAutoApproveEnabled,
  initialCertificationStatus,
  autoApproveWorkerByUserId,
  autoApproveWorkerByProfileId,
} = await import('../src/utils/autoApprove.js');

describe('Autoaprobación de trabajadores', () => {
  beforeEach(() => {
    delete process.env.AUTO_APPROVE_WORKERS;
    mockQueryBuilder.where.mockReset().mockReturnThis();
    mockQueryBuilder.first.mockReset().mockResolvedValue(null);
    mockQueryBuilder.update.mockReset().mockReturnThis();
    mockQueryBuilder.returning.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.AUTO_APPROVE_WORKERS;
  });

  it('por defecto deja el estado PENDING y no aprueba', async () => {
    expect(isAutoApproveEnabled()).toBe(false);
    expect(initialCertificationStatus()).toBe('PENDING');

    const result = await autoApproveWorkerByUserId('user-uuid');

    expect(result).toBe(false);
    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it('con el flag activo nace APPROVED y aprueba por user_id', async () => {
    process.env.AUTO_APPROVE_WORKERS = 'true';

    expect(isAutoApproveEnabled()).toBe(true);
    expect(initialCertificationStatus()).toBe('APPROVED');

    mockQueryBuilder.first.mockResolvedValue({ id: 'profile-uuid' });
    mockQueryBuilder.returning.mockResolvedValue([{ id: 'profile-uuid' }]);

    const result = await autoApproveWorkerByUserId('user-uuid');

    expect(result).toBe(true);
    expect(mockQueryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ certification_status: 'APPROVED' }),
    );
  });

  it('con el flag activo aprueba por profile_id', async () => {
    process.env.AUTO_APPROVE_WORKERS = 'true';
    mockQueryBuilder.returning.mockResolvedValue([{ id: 'profile-uuid' }]);

    const result = await autoApproveWorkerByProfileId('profile-uuid');

    expect(result).toBe(true);
    expect(mockQueryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ certification_status: 'APPROVED' }),
    );
  });
});
