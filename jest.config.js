// jest.config.js
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['./setup-jest.ts'],
  testTimeout: 30000,
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@actioncrew/streamix$': '<rootDir>/projects/streamix/src/lib/index.ts'
  },
};
