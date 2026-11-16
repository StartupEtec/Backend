import { jest } from '@jest/globals';

const mockQueryBuilder = {
  where: jest.fn(),
  select: jest.fn(),
  orderBy: jest.fn(),
};

mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
mockQueryBuilder.orderBy.mockResolvedValue([
  { id: 'cat-1', name: 'Electricidad', description: 'Servicios eléctricos', icon_url: null },
]);

const mockKnex = Object.assign(() => mockQueryBuilder, {
  fn: { now: () => new Date() },
  raw: (val) => val,
});

jest.unstable_mockModule('../src/database/db.js', () => ({
  default: mockKnex,
}));

const { default: categoryService } = await import('../src/services/CategoryService.js');
const { default: categoryController } = await import('../src/controllers/CategoryController.js');

describe('CategoryService', () => {
  beforeEach(() => {
    mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.orderBy.mockResolvedValue([
      { id: 'cat-1', name: 'Electricidad', description: 'Servicios eléctricos', icon_url: null },
    ]);
  });

  it('debe consultar categorías activas ordenadas por nombre', async () => {
    const result = await categoryService.listActive();
    expect(mockQueryBuilder.where).toHaveBeenCalledWith({ active: true });
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('id', 'name', 'description', 'icon_url');
    expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('name', 'asc');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Electricidad');
  });
});

describe('CategoryController', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('debe listar categorías activas con código 200', async () => {
    const mockCategories = [
      { id: 'cat-1', name: 'Electricidad', description: 'Servicios eléctricos', icon_url: null },
      { id: 'cat-2', name: 'Plomería', description: 'Reparaciones sanitarias', icon_url: null },
    ];

    jest.spyOn(categoryService, 'listActive').mockResolvedValue(mockCategories);

    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await categoryController.listActive(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ categories: mockCategories });
    expect(next).not.toHaveBeenCalled();
  });

  it('debe delegar el error a next(err) si el servicio falla', async () => {
    const error = new Error('Database error');
    jest.spyOn(categoryService, 'listActive').mockRejectedValue(error);

    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await categoryController.listActive(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
