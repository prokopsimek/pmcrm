import type { Config } from 'jest';
import baseConfig from '../jest.config';

const config: Config = {
  ...baseConfig,
  testRegex: '.*\\.integration\\.spec\\.ts$',
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/test/setup-integration.ts'],
  coverageDirectory: './coverage/integration',
  maxWorkers: 1, // Run integration tests serially to avoid DB conflicts
  detectOpenHandles: true,
  forceExit: true,
};

export default config;
