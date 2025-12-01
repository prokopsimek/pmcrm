import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ReminderStatus } from '@prisma/client';

export interface ReminderNotificationData {
  reminderId: string;
  contactId: string;
  userId: string;
}

@Processor('reminders')
@Injectable()
export class ReminderNotificationJob {
  private readonly logger = new Logger(ReminderNotificationJob.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process reminder notifications
   * This job runs periodically to check for due reminders and send notifications
   */
  @Process('send-notification')
  async handleReminderNotification(job: Job<ReminderNotificationData>) {
    const { reminderId, contactId, userId } = job.data;

    this.logger.log(`Processing reminder notification: ${reminderId}`);

    try {
      // Get reminder details
      const reminder = await this.prisma.reminder.findUnique({
        where: { id: reminderId },
        include: {
          contact: true,
        },
      });

      if (!reminder) {
        this.logger.warn(`Reminder not found: ${reminderId}`);
        return;
      }

      // Skip if already sent or completed
      if (reminder.status === ReminderStatus.SENT || reminder.status === ReminderStatus.COMPLETED) {
        this.logger.log(`Reminder already processed: ${reminderId}`);
        return;
      }

      // Create notification for user
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'REMINDER',
          title: `Time to reach out to ${reminder.contact.firstName}`,
          message:
            reminder.message ||
            `You scheduled a reminder to follow up with ${reminder.contact.firstName} ${reminder.contact.lastName || ''}`,
          metadata: {
            reminderId: reminder.id,
            contactId: reminder.contactId,
            contactName: `${reminder.contact.firstName} ${reminder.contact.lastName || ''}`.trim(),
          },
        },
      });

      // Update reminder status
      await this.prisma.reminder.update({
        where: { id: reminderId },
        data: {
          status: ReminderStatus.SENT,
          notifiedAt: new Date(),
        },
      });

      this.logger.log(`Notification sent for reminder: ${reminderId}`);
    } catch (error) {
      this.logger.error(`Failed to process reminder notification: ${reminderId}`, error);
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Process daily digest of upcoming reminders
   */
  @Process('daily-digest')
  async handleDailyDigest(job: Job<{ userId: string }>) {
    const { userId } = job.data;

    this.logger.log(`Processing daily digest for user: ${userId}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        this.logger.warn(`User not found: ${userId}`);
        return;
      }

      // Get reminders due in next 24 hours
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const upcomingReminders = await this.prisma.reminder.findMany({
        where: {
          contact: {
            userId,
          },
          status: ReminderStatus.PENDING,
          dueAt: {
            gte: new Date(),
            lte: tomorrow,
          },
        },
        include: {
          contact: true,
        },
        orderBy: {
          priority: 'desc',
        },
      });

      if (upcomingReminders.length === 0) {
        this.logger.log(`No upcoming reminders for user: ${userId}`);
        return;
      }

      // Create digest notification
      const contactNames = upcomingReminders
        .slice(0, 3)
        .map((r) => r.contact.firstName)
        .join(', ');

      const additionalCount = upcomingReminders.length - 3;
      const message = `You have ${upcomingReminders.length} upcoming reminder${upcomingReminders.length > 1 ? 's' : ''}: ${contactNames}${additionalCount > 0 ? ` and ${additionalCount} more` : ''}`;

      await this.prisma.notification.create({
        data: {
          userId,
          type: 'REMINDER',
          title: 'Daily Reminder Digest',
          message,
          metadata: {
            reminderCount: upcomingReminders.length,
            reminders: upcomingReminders.map((r) => ({
              id: r.id,
              contactId: r.contactId,
              contactName: `${r.contact.firstName} ${r.contact.lastName || ''}`.trim(),
              dueAt: r.dueAt,
            })),
          },
        },
      });

      this.logger.log(`Daily digest sent to user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to process daily digest for user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Process overdue reminders cleanup
   * Escalate priority for very overdue reminders
   */
  @Process('escalate-overdue')
  async handleOverdueEscalation(job: Job) {
    this.logger.log('Processing overdue reminder escalation');

    try {
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Find very overdue reminders (>7 days)
      const overdueReminders = await this.prisma.reminder.findMany({
        where: {
          status: {
            in: [ReminderStatus.PENDING, ReminderStatus.SNOOZED],
          },
          dueAt: {
            lt: sevenDaysAgo,
          },
        },
        include: {
          contact: true,
        },
      });

      this.logger.log(`Found ${overdueReminders.length} very overdue reminders`);

      // Update priorities for overdue reminders
      for (const reminder of overdueReminders) {
        const daysOverdue = Math.floor(
          (now.getTime() - reminder.dueAt!.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Boost priority for overdue items
        const newPriority = Math.min(reminder.priority + daysOverdue * 2, 100);

        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            priority: newPriority,
          },
        });
      }

      this.logger.log('Overdue reminder escalation completed');
    } catch (error) {
      this.logger.error('Failed to process overdue escalation', error);
      throw error;
    }
  }
}
