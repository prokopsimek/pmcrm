/**
 * Database test helpers for managing test database state
 */
import { PrismaClient } from '@prisma/client';

export class TestDbHelper {
  private static prisma: PrismaClient;

  static async initialize(): Promise<PrismaClient> {
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      });
    }
    return this.prisma;
  }

  static async cleanup(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  static async truncateAllTables(): Promise<void> {
    const prisma = await this.initialize();

    // Get all table names
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename != '_prisma_migrations'
    `;

    // Disable foreign key checks
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');

    // Truncate all tables
    for (const { tablename } of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
    }

    // Re-enable foreign key checks
    await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
  }

  static async seedTestUser(data: any = {}): Promise<any> {
    const prisma = await this.initialize();

    return await prisma.user.create({
      data: {
        email: data.email || 'test@example.com',
        fullName: data.fullName || 'Test User',
        subscriptionTier: data.subscriptionTier || 'free',
        settings: data.settings || {},
        ...data,
      },
    });
  }

  static async seedTestContact(userId: string, data: any = {}): Promise<any> {
    const prisma = await this.initialize();

    return await prisma.contact.create({
      data: {
        userId,
        firstName: data.firstName || 'John',
        lastName: data.lastName || 'Doe',
        email: data.email || 'john.doe@example.com',
        phone: data.phone || '+1234567890',
        relationshipStrength: data.relationshipStrength || 5,
        lastContactDate: data.lastContactDate || new Date(),
        ...data,
      },
    });
  }
}
