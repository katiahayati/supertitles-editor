module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '__tests__/integration.test.js',
    '__tests__/pdf-export.test.js',
    '__tests__/project-files.test.js'
  ],
  collectCoverageFrom: [
    '*.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!jest.config.js',
    '!coverage/**'
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40
    }
  },
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js']
};
