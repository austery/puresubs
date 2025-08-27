/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 50,  // Lower threshold for chrome extension
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  // Chrome extension specific setup
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Mock Chrome APIs
  setupFiles: ['<rootDir>/jest.chrome-mock.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(@puresubs)/)',
  ],
  extensionsToTreatAsEsm: ['.ts']
};