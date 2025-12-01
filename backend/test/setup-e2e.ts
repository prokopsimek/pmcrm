/**
 * Global test setup for E2E tests
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'warn';
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL || 'postgresql://test:test@localhost:5434/pmcrm_e2e';
process.env.PORT = '3001'; // Different port for E2E tests

// Extended timeout for E2E tests
jest.setTimeout(60000);

// Global setup - runs once before all test suites
beforeAll(async () => {
  console.log('Setting up E2E test environment...');

  // Run database migrations
  try {
    await execAsync('npm run db:migrate:e2e');
  } catch (error) {
    console.error('Failed to run E2E migrations:', error);
  }

  // Seed test data if needed
  try {
    await execAsync('npm run db:seed:e2e');
  } catch (error) {
    console.warn('No seed data available:', error);
  }
});

// Reset database state between test suites
afterEach(async () => {
  // Clean up created data while preserving seed data
});

// Global teardown
afterAll(async () => {
  console.log('Cleaning up E2E tests...');

  // Close all connections
  // await app.close();
  // await prisma.$disconnect();
});
