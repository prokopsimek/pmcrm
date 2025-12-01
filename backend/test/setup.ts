/**
 * Global test setup for unit tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Global test timeout
jest.setTimeout(10000);

// Mock Date for consistent tests
const mockDate = new Date('2024-01-01T00:00:00.000Z');
global.Date = class extends Date {
  constructor(date?: string | number | Date) {
    if (date) {
      super(date);
    } else {
      super(mockDate);
    }
  }

  static now() {
    return mockDate.getTime();
  }
} as DateConstructor;

// Global test utilities
global.expectToThrow = async (fn: () => Promise<any>, errorType?: any) => {
  await expect(fn()).rejects.toThrow(errorType);
};

// Silence console during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
