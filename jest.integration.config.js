module.exports = {
  displayName: 'Integration Tests',
  testMatch: ['<rootDir>/src/test/integration/**/*.test.{js,ts}'],
  testEnvironment: 'node',
  preset: 'ts-jest',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/integration/setup.ts'],
  testTimeout: 30000,
  collectCoverageFrom: [
    'api/**/*.js',
    '!api/**/node_modules/**'
  ],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'json', 'html']
}