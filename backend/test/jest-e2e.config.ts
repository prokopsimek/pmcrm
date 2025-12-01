import type { Config } from 'jest';
import baseConfig from '../jest.config.js';

const config: Config = {
  ...baseConfig,
  testRegex: '.*\\.e2e-spec\\.ts$',
  rootDir: '.',
  testTimeout: 60000,
  setupFilesAfterEnv: ['<rootDir>/test/setup-e2e.ts'],
  coverageDirectory: './coverage/e2e',
  maxWorkers: 1,
  detectOpenHandles: true,
  forceExit: true,
};

export default config;
