/**
 * Factory for creating test contact data
 */
import { faker } from '@faker-js/faker';

export interface ContactFactoryData {
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  relationshipStrength?: number;
  lastContactDate?: Date;
  contactFrequencyDays?: number;
  enrichmentData?: Record<string, any>;
  createdAt?: Date;
  deletedAt?: Date | null;
}

export class ContactFactory {
  /**
   * Build contact data without persisting
   */
  static build(userId: string, overrides: ContactFactoryData = {}): ContactFactoryData {
    const firstName = overrides.firstName || faker.person.firstName();
    const lastName = overrides.lastName || faker.person.lastName();

    return {
      userId,
      firstName,
      lastName,
      email: faker.internet.email({ firstName, lastName }),
      phone: faker.phone.number(),
      linkedinUrl: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
      relationshipStrength: faker.number.int({ min: 1, max: 10 }),
      lastContactDate: faker.date.recent({ days: 30 }),
      contactFrequencyDays: faker.number.int({ min: 7, max: 90 }),
      enrichmentData: {},
      createdAt: new Date(),
      deletedAt: null,
      ...overrides,
    };
  }

  /**
   * Build multiple contacts
   */
  static buildMany(
    userId: string,
    count: number,
    overrides: ContactFactoryData = {},
  ): ContactFactoryData[] {
    return Array.from({ length: count }, () => this.build(userId, overrides));
  }

  /**
   * Create a contact with Prisma
   */
  static async create(
    prisma: any,
    userId: string,
    overrides: ContactFactoryData = {},
  ): Promise<any> {
    const data = this.build(userId, overrides);
    return await prisma.contact.create({ data });
  }

  /**
   * Create multiple contacts
   */
  static async createMany(
    prisma: any,
    userId: string,
    count: number,
    overrides: ContactFactoryData = {},
  ): Promise<any[]> {
    const contacts = [];
    for (let i = 0; i < count; i++) {
      contacts.push(await this.create(prisma, userId, overrides));
    }
    return contacts;
  }

  /**
   * Build a contact with specific relationship strength
   */
  static buildWithStrength(
    userId: string,
    strength: number,
    overrides: ContactFactoryData = {},
  ): ContactFactoryData {
    return this.build(userId, { ...overrides, relationshipStrength: strength });
  }

  /**
   * Build a contact with recent interaction
   */
  static buildRecentlyContacted(
    userId: string,
    daysAgo: number = 1,
    overrides: ContactFactoryData = {},
  ): ContactFactoryData {
    const lastContactDate = new Date();
    lastContactDate.setDate(lastContactDate.getDate() - daysAgo);

    return this.build(userId, { ...overrides, lastContactDate });
  }

  /**
   * Build a contact needing follow-up
   */
  static buildNeedingFollowUp(
    userId: string,
    overrides: ContactFactoryData = {},
  ): ContactFactoryData {
    const lastContactDate = new Date();
    lastContactDate.setDate(lastContactDate.getDate() - 60); // 60 days ago

    return this.build(userId, {
      ...overrides,
      lastContactDate,
      contactFrequencyDays: 30,
      relationshipStrength: 7,
    });
  }
}
