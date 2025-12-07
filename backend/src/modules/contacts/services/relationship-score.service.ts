/**
 * Relationship Score Service
 * Calculates and updates relationship strength scores for contacts
 *
 * Algorithm calculates a score from 0-100 based on 5 factors:
 * 1. Recency Score (0-40 points) - When was the last contact
 * 2. Frequency Score (0-25 points) - How often do you interact
 * 3. Bidirectionality Score (0-15 points) - Do they initiate contact
 * 4. Engagement Depth (0-10 points) - Meetings vs emails
 * 5. User Investment (0-10 points) - Reminders and notes
 */
import { PrismaService } from '@/shared/database/prisma.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RelationshipScoreService {
  private readonly logger = new Logger(RelationshipScoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate relationship score for a contact
   * @param contactId - The contact ID to calculate score for
   * @returns Score from 0-100
   */
  async calculateScore(contactId: string): Promise<number> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        reminders: {
          where: {
            status: 'PENDING',
          },
        },
        contactNotes: true,
      },
    });

    if (!contact) {
      this.logger.warn(`Contact not found: ${contactId}`);
      return 0;
    }

    // Calculate each factor
    const recencyScore = this.calculateRecencyScore(contact.lastContact);
    const frequencyScore = await this.calculateFrequencyScore(contactId);
    const bidirectionalityScore = await this.calculateBidirectionalityScore(contactId);
    const engagementScore = await this.calculateEngagementScore(contactId);
    const investmentScore = this.calculateInvestmentScore(
      contact.reminders?.length ?? 0,
      contact.contactNotes?.length ?? 0,
    );

    const totalScore = Math.min(
      100,
      recencyScore + frequencyScore + bidirectionalityScore + engagementScore + investmentScore,
    );

    this.logger.debug(
      `Score for ${contactId}: recency=${recencyScore}, frequency=${frequencyScore}, ` +
        `bidirectionality=${bidirectionalityScore}, engagement=${engagementScore}, ` +
        `investment=${investmentScore}, total=${totalScore}`,
    );

    return Math.round(totalScore);
  }

  /**
   * Update contact's importance score in database
   * @param contactId - The contact ID to update
   */
  async updateContactScore(contactId: string): Promise<number> {
    const score = await this.calculateScore(contactId);

    await this.prisma.contact.update({
      where: { id: contactId },
      data: { importance: score },
    });

    this.logger.log(`Updated relationship score for contact ${contactId}: ${score}`);
    return score;
  }

  /**
   * Recalculate scores for all contacts of a user
   * @param userId - The user ID
   */
  async recalculateAllForUser(userId: string): Promise<void> {
    const contacts = await this.prisma.contact.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    this.logger.log(`Recalculating scores for ${contacts.length} contacts of user ${userId}`);

    // Process in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      await Promise.all(batch.map((contact) => this.updateContactScore(contact.id)));
    }

    this.logger.log(`Finished recalculating scores for user ${userId}`);
  }

  /**
   * Recalculate scores for multiple contacts
   * @param contactIds - Array of contact IDs
   */
  async recalculateForContacts(contactIds: string[]): Promise<void> {
    if (contactIds.length === 0) return;

    this.logger.log(`Recalculating scores for ${contactIds.length} contacts`);
    await Promise.all(contactIds.map((id) => this.updateContactScore(id)));
  }

  // ============================================================================
  // SCORE CALCULATION METHODS
  // ============================================================================

  /**
   * Calculate recency score (0-40 points)
   * Based on when was the last contact
   */
  private calculateRecencyScore(lastContact: Date | null): number {
    if (!lastContact) return 0;

    const daysSince = Math.floor(
      (Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSince <= 7) return 40;
    if (daysSince <= 30) return 30;
    if (daysSince <= 90) return 20;
    if (daysSince <= 180) return 10;
    return 0;
  }

  /**
   * Calculate frequency score (0-25 points)
   * Based on number of interactions in last 90 days
   */
  private async calculateFrequencyScore(contactId: string): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Count emails in last 90 days
    const emailCount = await this.prisma.emailThread.count({
      where: {
        contactId,
        occurredAt: { gte: ninetyDaysAgo },
      },
    });

    // Count activities in last 90 days
    const activityCount = await this.prisma.contactActivity.count({
      where: {
        contactId,
        occurredAt: { gte: ninetyDaysAgo },
      },
    });

    const totalInteractions = emailCount + activityCount;

    if (totalInteractions >= 10) return 25;
    if (totalInteractions >= 5) return 20;
    if (totalInteractions >= 3) return 15;
    if (totalInteractions >= 1) return 10;
    return 0;
  }

  /**
   * Calculate bidirectionality score (0-15 points)
   * Based on percentage of inbound emails (they contact you)
   */
  private async calculateBidirectionalityScore(contactId: string): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const emails = await this.prisma.emailThread.groupBy({
      by: ['direction'],
      where: {
        contactId,
        occurredAt: { gte: ninetyDaysAgo },
      },
      _count: true,
    });

    const inbound = emails.find((e) => e.direction === 'INBOUND')?._count ?? 0;
    const total = emails.reduce((sum, e) => sum + e._count, 0);

    if (total === 0) return 0;

    const inboundPercentage = (inbound / total) * 100;

    if (inboundPercentage > 50) return 15;
    if (inboundPercentage >= 25) return 10;
    if (inboundPercentage >= 10) return 5;
    return 0;
  }

  /**
   * Calculate engagement depth score (0-10 points)
   * Based on types of interactions (meetings > emails > nothing)
   */
  private async calculateEngagementScore(contactId: string): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Check for meetings or calls
    const meetingsOrCalls = await this.prisma.contactActivity.count({
      where: {
        contactId,
        occurredAt: { gte: ninetyDaysAgo },
        type: { in: ['MEETING', 'CALL'] },
      },
    });

    if (meetingsOrCalls > 0) return 10;

    // Check for emails
    const emailCount = await this.prisma.emailThread.count({
      where: {
        contactId,
        occurredAt: { gte: ninetyDaysAgo },
      },
    });

    if (emailCount > 0) return 5;

    return 0;
  }

  /**
   * Calculate user investment score (0-10 points)
   * Based on whether user has set reminders or written notes
   */
  private calculateInvestmentScore(activeReminders: number, notesCount: number): number {
    let score = 0;
    if (activeReminders > 0) score += 5;
    if (notesCount > 0) score += 5;
    return score;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get relationship label based on score
   * @param score - The relationship score (0-100)
   * @returns Label string
   */
  static getRelationshipLabel(score: number): 'strong' | 'moderate' | 'weak' | 'new' {
    if (score >= 80) return 'strong';
    if (score >= 50) return 'moderate';
    if (score >= 20) return 'weak';
    return 'new';
  }
}
