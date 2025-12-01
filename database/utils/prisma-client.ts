/**
 * Prisma Client Singleton
 * Ensures a single Prisma Client instance across the application
 */

import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Prisma Client Extensions
const prismaClientSingleton = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    errorFormat: 'colorless',
  }).$extends({
    query: {
      // Add soft delete filtering to all queries
      contact: {
        async findMany({ args, query }) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },
        async findUnique({ args, query }) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },
      },
      organization: {
        async findMany({ args, query }) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },
      },
    },
  });
};

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// Helper function to set RLS context
export async function setUserContext(prisma: PrismaClient, userId: string) {
  await prisma.$executeRawUnsafe(`SELECT set_current_user_id('${userId}')`);
}

// Helper function to clear RLS context
export async function clearUserContext(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`RESET app.current_user_id`);
}
