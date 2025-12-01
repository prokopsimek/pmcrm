import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';

/**
 * Dashboard Service
 * Business logic for dashboard statistics, follow-ups, recommendations, and activity
 */
@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get dashboard statistics
   */
  async getStats(userId: string) {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get total contacts
    const totalContacts = await this.prisma.contact.count({
      where: { userId, deletedAt: null },
    });

    const totalContactsLastWeek = await this.prisma.contact.count({
      where: { userId, deletedAt: null, createdAt: { lte: lastWeek } },
    });

    // Get due today and overdue reminders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Reminders don't have userId directly - we need to go through contact
    const dueToday = await this.prisma.reminder.count({
      where: {
        contact: { userId },
        scheduledFor: { gte: today, lt: tomorrow },
        completedAt: null,
        snoozedUntil: null,
      },
    });

    const overdue = await this.prisma.reminder.count({
      where: {
        contact: { userId },
        scheduledFor: { lt: today },
        completedAt: null,
        snoozedUntil: null,
      },
    });

    // Get new contacts this week
    const newThisWeek = await this.prisma.contact.count({
      where: { userId, deletedAt: null, createdAt: { gte: lastWeek } },
    });

    const newLastWeek = await this.prisma.contact.count({
      where: {
        userId,
        deletedAt: null,
        createdAt: { gte: twoWeeksAgo, lt: lastWeek },
      },
    });

    // Calculate percentage changes
    const contactsChange =
      totalContactsLastWeek > 0
        ? ((totalContacts - totalContactsLastWeek) / totalContactsLastWeek) * 100
        : 0;

    const newThisWeekChange =
      newLastWeek > 0 ? ((newThisWeek - newLastWeek) / newLastWeek) * 100 : 0;

    return {
      totalContacts,
      dueToday,
      overdue,
      newThisWeek,
      contactsChange: Math.round(contactsChange * 10) / 10,
      newThisWeekChange: Math.round(newThisWeekChange * 10) / 10,
    };
  }

  /**
   * Get pending follow-ups
   */
  async getPendingFollowups(userId: string, params: { limit: number; includeOverdue: boolean }) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const reminders = await this.prisma.reminder.findMany({
      where: {
        contact: { userId },
        completedAt: null,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: today } }],
        scheduledFor: params.includeOverdue ? undefined : { lte: today },
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            lastContact: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
      take: params.limit,
    });

    return reminders.map((reminder) => ({
      id: reminder.id,
      contact: reminder.contact,
      dueDate: reminder.scheduledFor,
      lastContactedAt: reminder.contact.lastContact,
      relationshipStrength: this.calculateRelationshipStrength(reminder.contact),
      reminderFrequency: reminder.frequencyDays,
      isPastDue: reminder.scheduledFor < new Date(),
    }));
  }

  /**
   * Get AI recommendations (from AIInsight table)
   */
  async getRecommendations(
    userId: string,
    params: { period: 'daily' | 'weekly' | 'monthly'; limit: number },
  ) {
    // Get AI insights for user's contacts
    const insights = await this.prisma.aIInsight.findMany({
      where: {
        contact: { userId },
        type: {
          in: ['CONTACT_RECOMMENDATION', 'FOLLOW_UP_SUGGESTION', 'NETWORKING_OPPORTUNITY'],
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
          },
        },
      },
      orderBy: { confidence: 'desc' },
      take: params.limit,
    });

    return insights;
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(userId: string, params: { limit: number; offset: number }) {
    const activities = await this.prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: params.offset,
      take: params.limit,
    });

    return activities;
  }

  /**
   * Dismiss a recommendation (AI Insight)
   */
  async dismissRecommendation(userId: string, recommendationId: string) {
    const insight = await this.prisma.aIInsight.findFirst({
      where: { id: recommendationId, contact: { userId } },
    });

    if (!insight) {
      throw new NotFoundException('Recommendation not found');
    }

    // Since AIInsight doesn't have dismissedAt field, we record as unhelpful feedback
    await this.prisma.recommendationFeedback.create({
      data: {
        recommendationId,
        userId,
        isHelpful: false,
        comment: 'dismissed',
      },
    });

    return { success: true };
  }

  /**
   * Snooze a recommendation
   * Note: AIInsight doesn't have snoozedUntil field, so we record feedback instead
   */
  async snoozeRecommendation(userId: string, recommendationId: string, days: number) {
    const insight = await this.prisma.aIInsight.findFirst({
      where: { id: recommendationId, contact: { userId } },
    });

    if (!insight) {
      throw new NotFoundException('Recommendation not found');
    }

    // Record snooze as feedback with comment
    await this.prisma.recommendationFeedback.create({
      data: {
        recommendationId,
        userId,
        isHelpful: false,
        comment: `snoozed for ${days} days`,
      },
    });

    return { success: true };
  }

  /**
   * Provide feedback on a recommendation
   */
  async feedbackRecommendation(userId: string, recommendationId: string, isHelpful: boolean) {
    const insight = await this.prisma.aIInsight.findFirst({
      where: { id: recommendationId, contact: { userId } },
    });

    if (!insight) {
      throw new NotFoundException('Recommendation not found');
    }

    await this.prisma.recommendationFeedback.create({
      data: {
        recommendationId,
        userId,
        isHelpful,
      },
    });

    return { success: true };
  }

  /**
   * Mark follow-up as done
   */
  async markFollowupDone(userId: string, followupId: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: followupId, contact: { userId } },
    });

    if (!reminder) {
      throw new NotFoundException('Follow-up not found');
    }

    await this.prisma.reminder.update({
      where: { id: followupId },
      data: { completedAt: new Date(), status: 'COMPLETED' },
    });

    // Create activity log
    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'reminder_completed',
        entity: 'reminder',
        entityId: followupId,
        metadata: { contactId: reminder.contactId },
      },
    });

    return { success: true };
  }

  /**
   * Snooze a follow-up
   */
  async snoozeFollowup(userId: string, followupId: string, days: number) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: followupId, contact: { userId } },
    });

    if (!reminder) {
      throw new NotFoundException('Follow-up not found');
    }

    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + days);

    await this.prisma.reminder.update({
      where: { id: followupId },
      data: { snoozedUntil: snoozeUntil, status: 'SNOOZED' },
    });

    return { success: true };
  }

  /**
   * Calculate relationship strength based on contact history
   * @private
   */
  private calculateRelationshipStrength(contact: { lastContact: Date | null }): number {
    // Simple algorithm - can be enhanced with ML
    let strength = 50; // Base score

    // Increase based on recent contact
    if (contact.lastContact) {
      const daysSinceContact = Math.floor(
        (Date.now() - new Date(contact.lastContact).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceContact < 7) strength += 30;
      else if (daysSinceContact < 30) strength += 20;
      else if (daysSinceContact < 90) strength += 10;
      else strength -= 10;
    }

    return Math.max(0, Math.min(100, strength));
  }
}
