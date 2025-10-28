import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './'
});

const config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['<rootDir>/jest.env-setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/']
};

export default createJestConfig(config);
