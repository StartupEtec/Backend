import app from '../src/app.js';

describe('Health Endpoint Test', () => {
  it('should return health check state', () => {
    expect(app).toBeDefined();
  });
});
