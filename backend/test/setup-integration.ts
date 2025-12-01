/**
 * Global test setup for integration tests
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5433/pmcrm_test';

// Extended timeout for integration tests
jest.setTimeout(30000);

// Global setup - runs once before all tests
beforeAll(async () => {
  console.log('Setting up integration test database...');

  // Run database migrations
  try {
    await execAsync('npm run db:migrate:test');
  } catch (error) {
    console.error('Failed to run migrations:', error);
  }
});

// Clean database between tests
beforeEach(async () => {
  // Truncate all tables except migrations
  // This will be implemented with Prisma client
});

// Global teardown
afterAll(async () => {
  console.log('Cleaning up integration tests...');

  // Close all database connections
  // await prisma.$disconnect();
});

// Silence console during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  };
}
