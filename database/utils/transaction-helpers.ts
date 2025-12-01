/**
 * Database Transaction Helpers
 * Utilities for handling complex transactions and data operations
 */

import { PrismaClient, Prisma } from '@prisma/client';
import prisma from './prisma-client';

/**
 * Transaction with automatic rollback on error
 */
export async function withTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return await prisma.$transaction(async (tx) => {
    try {
      return await callback(tx);
    } catch (error) {
      // Transaction will automatically rollback
      throw error;
    }
  });
}

/**
 * Retry logic for transient database errors
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Only retry on specific transient errors
      const shouldRetry =
        error instanceof Error &&
        (error.message.includes('connection') ||
          error.message.includes('timeout') ||
          error.message.includes('deadlock'));

      if (!shouldRetry || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Batch insert with chunking to avoid query size limits
 */
export async function batchInsert<T>(
  model: any,
  data: T[],
  chunkSize: number = 1000,
): Promise<void> {
  const chunks = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    await model.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }
}

/**
 * Soft delete utility
 */
export async function softDelete(
  model: any,
  where: any,
): Promise<number> {
  const result = await model.updateMany({
    where: {
      ...where,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  return result.count;
}

/**
 * Restore soft deleted records
 */
export async function restore(
  model: any,
  where: any,
): Promise<number> {
  const result = await model.updateMany({
    where: {
      ...where,
      deletedAt: { not: null },
    },
    data: {
      deletedAt: null,
    },
  });

  return result.count;
}

/**
 * Pagination helper
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  orderBy?: any;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export async function paginate<T>(
  model: any,
  where: any,
  params: PaginationParams,
): Promise<PaginatedResult<T>> {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const skip = (page - 1) * pageSize;

  const [data, totalCount] = await Promise.all([
    model.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: params.orderBy,
    }),
    model.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    data,
    meta: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * Full-text search helper
 */
export async function searchContacts(
  userId: string,
  searchTerm: string,
  limit: number = 20,
) {
  return await prisma.$queryRaw`
    SELECT
      id,
      first_name,
      last_name,
      email,
      phone,
      relationship_strength,
      ts_rank(search_vector, query) AS rank
    FROM
      contacts,
      to_tsquery('contact_search', ${searchTerm}) query
    WHERE
      user_id = ${userId}::uuid
      AND deleted_at IS NULL
      AND search_vector @@ query
    ORDER BY
      rank DESC
    LIMIT ${limit}
  `;
}

/**
 * Upsert helper (insert or update)
 */
export async function upsert<T>(
  model: any,
  where: any,
  create: T,
  update: Partial<T>,
): Promise<T> {
  return await model.upsert({
    where,
    create,
    update,
  });
}

/**
 * Bulk update helper
 */
export async function bulkUpdate(
  model: any,
  updates: Array<{ where: any; data: any }>,
): Promise<void> {
  await withTransaction(async (tx) => {
    for (const { where, data } of updates) {
      await tx[model.name].update({ where, data });
    }
  });
}

/**
 * Connection pool health check
 */
export async function healthCheck(): Promise<{
  database: boolean;
  latencyMs: number;
}> {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;
    return { database: true, latencyMs };
  } catch (error) {
    console.error('Database health check failed:', error);
    return { database: false, latencyMs: -1 };
  }
}

/**
 * Disconnect all connections (for graceful shutdown)
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
