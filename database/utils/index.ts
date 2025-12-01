/**
 * Database Utilities - Public API
 * Export all database utilities from a single entry point
 */

// Prisma Client
export { default as prisma, setUserContext, clearUserContext } from './prisma-client';

// Transaction Helpers
export {
  withTransaction,
  withRetry,
  batchInsert,
  softDelete,
  restore,
  paginate,
  searchContacts,
  upsert,
  bulkUpdate,
  healthCheck,
  disconnect,
  type PaginationParams,
  type PaginatedResult,
} from './transaction-helpers';

// Connection Pool
export {
  buildConnectionString,
  generatePgBouncerConfig,
  getPoolConfig,
  validateDatabaseUrl,
  extractDatabaseName,
  ConnectionPoolMonitor,
  devPoolConfig,
  prodPoolConfig,
  type ConnectionPoolConfig,
} from './connection-pool';
