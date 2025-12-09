import { PrismaService } from '@/shared/database/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';

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
            phone: true,
            company: true,
            position: true,
            notes: true,
            tags: true,
            importance: true,
            lastContact: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { confidence: 'desc' },
      take: params.limit,
    });

    return insights.map((insight) => ({
      id: insight.id,
      contactId: insight.contactId,
      contact: this.mapContactToResponse(insight.contact),
      reason: insight.content,
      urgencyScore: Math.round((insight.confidence ?? 0) * 100),
      triggerType: this.mapInsightTypeToTrigger(insight.type),
      createdAt: insight.createdAt.toISOString(),
    }));
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(userId: string, params: { limit: number; offset: number }) {
    const [activities, emailThreads, notes] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: params.offset,
        take: params.limit,
      }),
      this.prisma.emailThread.findMany({
        where: {
          contact: { userId },
        },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              company: true,
              position: true,
              notes: true,
              tags: true,
              importance: true,
              lastContact: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { occurredAt: 'desc' },
        skip: params.offset,
        take: params.limit,
      }),
      this.prisma.note.findMany({
        where: { userId },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              company: true,
              position: true,
              notes: true,
              tags: true,
              importance: true,
              lastContact: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.offset,
        take: params.limit,
      }),
    ]);

    const reminderIds = activities
      .filter(
        (activity): activity is typeof activity & { entityId: string } =>
          activity.entity === 'reminder' && !!activity.entityId,
      )
      .map((activity) => activity.entityId);

    const reminders = reminderIds.length
      ? await this.prisma.reminder.findMany({
          where: { id: { in: reminderIds } },
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                company: true,
                position: true,
                notes: true,
                tags: true,
                importance: true,
                lastContact: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        })
      : [];

    const reminderMap = new Map(reminders.map((reminder) => [reminder.id, reminder]));

    const activityItems = activities.map((activity) => {
      const reminder =
        activity.entity === 'reminder' && activity.entityId
          ? reminderMap.get(activity.entityId)
          : undefined;
      const contact = reminder?.contact;
      const contactIdFromMetadata = (activity.metadata as { contactId?: string } | null)?.contactId;

      return {
        id: activity.id,
        type: this.mapActivityType(activity.action),
        description: this.buildActivityDescription(activity.action, contact),
        timestamp: activity.createdAt.toISOString(),
        contactId: contact?.id ?? contactIdFromMetadata,
        contact: contact ? this.mapContactToResponse(contact) : undefined,
        metadata: activity.metadata ?? undefined,
      };
    });

    const emailItems = emailThreads.map((email) => ({
      id: email.id,
      type: 'email_sent',
      description: email.subject || 'No subject',
      timestamp: email.occurredAt.toISOString(),
      contactId: email.contactId,
      contact: this.mapContactToResponse(email.contact),
      metadata: (email.metadata as Record<string, unknown>) ?? undefined,
    }));

    const noteItems = notes.map((note) => ({
      id: note.id,
      type: 'note_added',
      description: note.content.substring(0, 50) + (note.content.length > 50 ? '...' : ''),
      timestamp: note.createdAt.toISOString(),
      contactId: note.contactId,
      contact: this.mapContactToResponse(note.contact),
      metadata: undefined,
    }));

    return [...activityItems, ...emailItems, ...noteItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, params.limit);
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

  private mapContactToResponse(contact: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    position: string | null;
    notes: string | null;
    tags: string[] | null;
    importance: number | null;
    lastContact: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName || '',
      email: contact.email || undefined,
      phone: contact.phone || undefined,
      company: contact.company || undefined,
      position: contact.position || undefined,
      notes: contact.notes || undefined,
      tags: contact.tags || undefined,
      lastContactedAt: contact.lastContact ? contact.lastContact.toISOString() : undefined,
      importance: contact.importance ?? undefined,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };
  }

  private mapInsightTypeToTrigger(
    insightType: string,
  ): 'job_change' | 'company_news' | 'birthday' | 'overdue' | 'general' {
    switch (insightType) {
      case 'FOLLOW_UP_SUGGESTION':
        return 'overdue';
      case 'NETWORKING_OPPORTUNITY':
        return 'company_news';
      case 'CONTACT_RECOMMENDATION':
        return 'general';
      case 'IMPORTANCE_CHANGE':
        return 'general';
      case 'RELATIONSHIP_STRENGTH':
        return 'general';
      case 'INTERACTION_PATTERN':
        return 'general';
      default:
        return 'general';
    }
  }

  private mapActivityType(action: string): string {
    // Currently actions are stored in activityLog.action; map known ones and fall back to raw value
    switch (action) {
      case 'reminder_completed':
        return 'reminder_completed';
      case 'contact_added':
        return 'contact_added';
      case 'email_sent':
        return 'email_sent';
      case 'meeting':
        return 'meeting';
      case 'integration_connected':
        return 'integration_connected';
      case 'note_added':
        return 'note_added';
      default:
        return action;
    }
  }

  private buildActivityDescription(
    action: string,
    contact?: {
      id: string;
      firstName: string;
      lastName: string | null;
      company: string | null;
    } | null,
  ): string {
    const fullName = contact ? `${contact.firstName} ${contact.lastName || ''}`.trim() : null;

    switch (action) {
      case 'reminder_completed':
        return fullName ? `Completed reminder for ${fullName}` : 'Completed reminder';
      case 'contact_added':
        return fullName ? `Added contact ${fullName}` : 'Added a contact';
      case 'email_sent':
        return fullName ? `Sent an email to ${fullName}` : 'Sent an email';
      case 'meeting':
        return fullName ? `Logged a meeting with ${fullName}` : 'Logged a meeting';
      case 'integration_connected':
        return 'Connected an integration';
      case 'note_added':
        return fullName ? `Added a note for ${fullName}` : 'Added a note';
      default:
        return fullName ? `${action.replace(/_/g, ' ')} (${fullName})` : action.replace(/_/g, ' ');
    }
  }
}
