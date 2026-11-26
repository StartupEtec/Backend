export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/database/**/*.js',
    '!src/routes/**/*.js',
    '!src/middlewares/**/*.js',
    '!src/services/providers/**/*.js',
    '!src/utils/dashboard.html',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 70,
      lines: 70,
      branches: 55,
      functions: 60,
    },
  },
};
