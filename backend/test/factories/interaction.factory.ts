/**
 * Factory for creating test interaction data
 */
import { faker } from '@faker-js/faker';

export type InteractionType = 'email' | 'meeting' | 'call' | 'linkedin' | 'calendar';
export type InteractionDirection = 'inbound' | 'outbound' | 'bidirectional';

export interface InteractionFactoryData {
  userId?: string;
  interactionType?: InteractionType;
  direction?: InteractionDirection;
  subject?: string;
  summary?: string;
  occurredAt?: Date;
  externalId?: string;
  externalSource?: string;
  sentimentScore?: number;
  createdAt?: Date;
}

export class InteractionFactory {
  /**
   * Build interaction data without persisting
   */
  static build(userId: string, overrides: InteractionFactoryData = {}): InteractionFactoryData {
    const interactionType =
      overrides.interactionType || faker.helpers.arrayElement(['email', 'meeting', 'call']);

    return {
      userId,
      interactionType,
      direction: faker.helpers.arrayElement(['inbound', 'outbound']),
      subject: faker.lorem.sentence(),
      summary: faker.lorem.paragraph(),
      occurredAt: faker.date.recent({ days: 30 }),
      externalId: faker.string.uuid(),
      externalSource: interactionType === 'email' ? 'gmail' : interactionType,
      sentimentScore: faker.number.float({ min: -1, max: 1, multipleOf: 0.01 }),
      createdAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Build multiple interactions
   */
  static buildMany(
    userId: string,
    count: number,
    overrides: InteractionFactoryData = {},
  ): InteractionFactoryData[] {
    return Array.from({ length: count }, () => this.build(userId, overrides));
  }

  /**
   * Create an interaction with Prisma
   */
  static async create(
    prisma: any,
    userId: string,
    contactIds: string[] = [],
    overrides: InteractionFactoryData = {},
  ): Promise<any> {
    const data = this.build(userId, overrides);

    const interaction = await prisma.interaction.create({ data });

    // Link to contacts if provided
    if (contactIds.length > 0) {
      await prisma.interactionParticipant.createMany({
        data: contactIds.map((contactId) => ({
          interactionId: interaction.id,
          contactId,
        })),
      });
    }

    return interaction;
  }

  /**
   * Build email interaction
   */
  static buildEmail(
    userId: string,
    overrides: InteractionFactoryData = {},
  ): InteractionFactoryData {
    return this.build(userId, {
      interactionType: 'email',
      externalSource: 'gmail',
      ...overrides,
    });
  }

  /**
   * Build meeting interaction
   */
  static buildMeeting(
    userId: string,
    overrides: InteractionFactoryData = {},
  ): InteractionFactoryData {
    return this.build(userId, {
      interactionType: 'meeting',
      direction: 'bidirectional',
      externalSource: 'google_calendar',
      ...overrides,
    });
  }

  /**
   * Build call interaction
   */
  static buildCall(userId: string, overrides: InteractionFactoryData = {}): InteractionFactoryData {
    return this.build(userId, {
      interactionType: 'call',
      subject: 'Phone Call',
      ...overrides,
    });
  }

  /**
   * Build LinkedIn interaction
   */
  static buildLinkedIn(
    userId: string,
    overrides: InteractionFactoryData = {},
  ): InteractionFactoryData {
    return this.build(userId, {
      interactionType: 'linkedin',
      externalSource: 'linkedin',
      ...overrides,
    });
  }
}
