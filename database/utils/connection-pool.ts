/**
 * Database Connection Pool Configuration
 * Optimizes database connections for high-traffic scenarios
 */

/**
 * Recommended Connection Pool Settings
 *
 * For NestJS/Node.js applications with PostgreSQL:
 *
 * CONNECTION_LIMIT = (CPU_CORES * 2) + 1
 *
 * Example for 4-core server:
 * - Pool size: (4 * 2) + 1 = 9 connections
 *
 * PgBouncer recommended settings:
 * - default_pool_size: 25
 * - max_client_conn: 100
 * - pool_mode: transaction (for multi-tenant with RLS)
 */

export interface ConnectionPoolConfig {
  poolMin: number;
  poolMax: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statementTimeout: number; // milliseconds
}

/**
 * Development configuration
 */
export const devPoolConfig: ConnectionPoolConfig = {
  poolMin: 2,
  poolMax: 10,
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 5000, // 5 seconds
  statementTimeout: 10000, // 10 seconds
};

/**
 * Production configuration
 */
export const prodPoolConfig: ConnectionPoolConfig = {
  poolMin: 5,
  poolMax: 20,
  idleTimeoutMillis: 60000, // 1 minute
  connectionTimeoutMillis: 10000, // 10 seconds
  statementTimeout: 30000, // 30 seconds
};

/**
 * Build Prisma connection string with pool settings
 */
export function buildConnectionString(
  baseUrl: string,
  config: ConnectionPoolConfig,
): string {
  const url = new URL(baseUrl);

  url.searchParams.set('connection_limit', config.poolMax.toString());
  url.searchParams.set('pool_timeout', (config.connectionTimeoutMillis / 1000).toString());
  url.searchParams.set('statement_timeout', config.statementTimeout.toString());

  // Enable prepared statements (improves performance)
  url.searchParams.set('pgbouncer', 'true');

  return url.toString();
}

/**
 * Connection pool monitoring
 */
export class ConnectionPoolMonitor {
  private metrics = {
    activeConnections: 0,
    idleConnections: 0,
    waitingClients: 0,
    totalQueries: 0,
    errorCount: 0,
  };

  incrementActive() {
    this.metrics.activeConnections++;
  }

  decrementActive() {
    this.metrics.activeConnections--;
  }

  incrementQueries() {
    this.metrics.totalQueries++;
  }

  incrementErrors() {
    this.metrics.errorCount++;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      errorCount: 0,
    };
  }
}

/**
 * PgBouncer configuration generator
 */
export function generatePgBouncerConfig(
  databaseUrl: string,
  maxClientConn: number = 100,
  defaultPoolSize: number = 25,
): string {
  const url = new URL(databaseUrl);

  return `
; PgBouncer configuration for Personal Network CRM
; Place in /etc/pgbouncer/pgbouncer.ini

[databases]
pmcrm = host=${url.hostname} port=${url.port || 5432} dbname=${url.pathname.slice(1)} user=${url.username}

[pgbouncer]
; Connection limits
max_client_conn = ${maxClientConn}
default_pool_size = ${defaultPoolSize}
reserve_pool_size = 5
reserve_pool_timeout = 3

; Pool mode (transaction recommended for RLS)
pool_mode = transaction

; Logging
admin_users = ${url.username}
stats_users = ${url.username}

; Timeouts
query_timeout = 30
query_wait_timeout = 120
idle_transaction_timeout = 600

; Security
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Performance
server_idle_timeout = 600
server_lifetime = 3600
server_connect_timeout = 15
`;
}

/**
 * Environment-specific configuration selector
 */
export function getPoolConfig(): ConnectionPoolConfig {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return prodPoolConfig;
    case 'test':
      return {
        ...devPoolConfig,
        poolMax: 5, // Limit connections in test environment
      };
    default:
      return devPoolConfig;
  }
}

/**
 * Validate database URL
 */
export function validateDatabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'postgresql:' ||
      parsed.protocol === 'postgres:' ||
      parsed.hostname !== '' &&
      parsed.pathname !== ''
    );
  } catch {
    return false;
  }
}

/**
 * Extract database name from connection string
 */
export function extractDatabaseName(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.pathname.slice(1) || null;
  } catch {
    return null;
  }
}
