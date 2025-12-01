/**
 * Factory for creating test user data
 */
import { faker } from '@faker-js/faker';

export interface UserFactoryData {
  email?: string;
  fullName?: string;
  subscriptionTier?: 'free' | 'pro' | 'team';
  settings?: Record<string, any>;
  createdAt?: Date;
  deletedAt?: Date | null;
}

export class UserFactory {
  /**
   * Build user data without persisting
   */
  static build(overrides: UserFactoryData = {}): UserFactoryData {
    return {
      email: faker.internet.email(),
      fullName: faker.person.fullName(),
      subscriptionTier: 'free',
      settings: {},
      createdAt: new Date(),
      deletedAt: null,
      ...overrides,
    };
  }

  /**
   * Build multiple users
   */
  static buildMany(count: number, overrides: UserFactoryData = {}): UserFactoryData[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }

  /**
   * Create a user with Prisma (requires Prisma client)
   */
  static async create(prisma: any, overrides: UserFactoryData = {}): Promise<any> {
    const data = this.build(overrides);
    return await prisma.user.create({ data });
  }

  /**
   * Create multiple users
   */
  static async createMany(
    prisma: any,
    count: number,
    overrides: UserFactoryData = {},
  ): Promise<any[]> {
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.create(prisma, overrides));
    }
    return users;
  }
}
