/**
 * Database fixtures for E2E tests
 * Provides database access and cleanup utilities
 */
import { test as base } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

type DatabaseFixture = {
  prisma: PrismaClient;
  cleanupDatabase: () => Promise<void>;
  createTestUser: () => Promise<{
    id: string;
    email: string;
    password: string;
    fullName: string;
  }>;
  createTestContact: (userId: string, data?: Partial<any>) => Promise<any>;
};

/**
 * Extend base test with database fixture
 */
export const test = base.extend<DatabaseFixture>({
  prisma: async ({}, use) => {
    const prisma = new PrismaClient();
    await use(prisma);
    await prisma.$disconnect();
  },

  cleanupDatabase: async ({ prisma }, use) => {
    const cleanup = async () => {
      // Delete in reverse order of dependencies
      await prisma.generatedIcebreaker.deleteMany({});
      await prisma.aiInsight.deleteMany({});
      await prisma.reminder.deleteMany({});
      await prisma.interaction.deleteMany({});
      await prisma.contactTag.deleteMany({});
      await prisma.tag.deleteMany({});
      await prisma.emailSyncConfig.deleteMany({});
      await prisma.integration.deleteMany({});
      await prisma.consentRecord.deleteMany({});
      await prisma.auditLog.deleteMany({});
      await prisma.contact.deleteMany({});
      await prisma.organization.deleteMany({});
      await prisma.user.deleteMany({});
    };

    await use(cleanup);
  },

  createTestUser: async ({ prisma }, use) => {
    const createUser = async () => {
      const timestamp = Date.now();
      const userData = {
        email: `test-${timestamp}@example.com`,
        password: 'SecurePassword123!',
        fullName: 'Test User',
      };

      // Note: In a real scenario, you'd call the registration API endpoint
      // This is a simplified version for fixture purposes
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          fullName: userData.fullName,
          passwordHash: 'hashed-password', // In reality, this would be properly hashed
          emailVerified: true,
        },
      });

      return {
        id: user.id,
        ...userData,
      };
    };

    await use(createUser);
  },

  createTestContact: async ({ prisma }, use) => {
    const createContact = async (userId: string, data: Partial<any> = {}) => {
      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: data.firstName || 'John',
          lastName: data.lastName || 'Doe',
          email: data.email || `contact-${Date.now()}@example.com`,
          phone: data.phone || '+1234567890',
          ...data,
        },
      });

      return contact;
    };

    await use(createContact);
  },
});

export { expect } from '@playwright/test';
