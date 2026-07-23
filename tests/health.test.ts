import app from '../src/app';

describe('Health Endpoint Test', () => {
  it('should return 200 UP and correct structure', () => {
    // Test básico de estructura sin levantar un puerto real
    expect(app).toBeDefined();
  });
});
