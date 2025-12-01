import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { DueDateCalculatorService } from './services/due-date-calculator.service';
import { PrioritySorterService } from './services/priority-sorter.service';
import { ReminderStatus } from '@prisma/client';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dueDateCalculator: DueDateCalculatorService,
    private readonly prioritySorter: PrioritySorterService,
  ) {}

  /**
   * Create a new reminder for a contact
   */
  async createReminder(userId: string, dto: CreateReminderDto) {
    // Verify contact belongs to user
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: dto.contactId,
        userId,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const dueAt = dto.frequencyDays
      ? this.dueDateCalculator.calculateNextDueDate(contact.lastContact, dto.frequencyDays)
      : dto.scheduledFor;

    const priority = this.prioritySorter.calculatePriority(
      {
        importance: contact.importance,
        frequency: contact.frequency,
        lastContact: contact.lastContact,
      },
      0,
    );

    return this.prisma.reminder.create({
      data: {
        contactId: dto.contactId,
        title: dto.title,
        message: dto.message,
        scheduledFor: dto.scheduledFor,
        dueAt,
        frequencyDays: dto.frequencyDays,
        priority,
        status: ReminderStatus.PENDING,
      },
      include: {
        contact: true,
      },
    });
  }

  /**
   * Set or update reminder frequency for a contact
   */
  async setReminderFrequency(contactId: string, frequencyDays: number) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const dueAt = this.dueDateCalculator.calculateNextDueDate(contact.lastContact, frequencyDays);

    const priority = this.prioritySorter.calculatePriority(
      {
        importance: contact.importance,
        frequency: contact.frequency,
        lastContact: contact.lastContact,
      },
      0,
    );

    // Check if reminder already exists for this contact
    const existingReminder = await this.prisma.reminder.findFirst({
      where: {
        contactId,
        status: {
          in: [ReminderStatus.PENDING, ReminderStatus.SNOOZED],
        },
      },
    });

    if (existingReminder) {
      return this.prisma.reminder.update({
        where: { id: existingReminder.id },
        data: {
          frequencyDays,
          dueAt,
          priority,
        },
      });
    }

    return this.prisma.reminder.create({
      data: {
        contactId,
        title: `Follow up with ${contact.firstName}`,
        frequencyDays,
        dueAt,
        scheduledFor: dueAt,
        priority,
        status: ReminderStatus.PENDING,
      },
    });
  }

  /**
   * Bulk set frequency for contacts by tags
   */
  async bulkSetFrequency(tags: string[], frequencyDays: number) {
    const contacts = await this.prisma.contact.findMany({
      where: {
        tags: {
          hasSome: tags,
        },
      },
    });

    const reminders = await Promise.all(
      contacts.map((contact) => this.setReminderFrequency(contact.id, frequencyDays)),
    );

    return {
      count: reminders.length,
      reminders,
    };
  }

  /**
   * Get due reminders for a user within a timeframe
   */
  async getDueReminders(userId: string, filter: 'day' | 'week' | 'month' = 'week') {
    const endDate = this.dueDateCalculator.getTimeframeEndDate(filter);

    const reminders = await this.prisma.reminder.findMany({
      where: {
        contact: {
          userId,
        },
        status: {
          in: [ReminderStatus.PENDING, ReminderStatus.SNOOZED],
        },
        dueAt: {
          lte: endDate,
        },
      },
      include: {
        contact: true,
      },
    });

    // Recalculate priorities based on current overdue status
    const remindersWithUpdatedPriority = reminders.map((reminder) => {
      const daysOverdue = this.dueDateCalculator.getDaysOverdue(reminder.dueAt!);
      const priority = this.prioritySorter.calculatePriority(
        {
          importance: reminder.contact.importance,
          frequency: reminder.contact.frequency,
          lastContact: reminder.contact.lastContact,
        },
        daysOverdue,
      );

      return {
        ...reminder,
        priority,
        daysOverdue,
      };
    });

    return this.prioritySorter.sortByPriority(remindersWithUpdatedPriority as any);
  }

  /**
   * Get overdue reminders for a user
   */
  async getOverdueReminders(userId: string) {
    const now = new Date();

    const reminders = await this.prisma.reminder.findMany({
      where: {
        contact: {
          userId,
        },
        status: {
          in: [ReminderStatus.PENDING, ReminderStatus.SNOOZED],
        },
        dueAt: {
          lt: now,
        },
      },
      include: {
        contact: true,
      },
    });

    // Calculate priority with overdue boost
    const remindersWithPriority = reminders.map((reminder) => {
      const daysOverdue = this.dueDateCalculator.getDaysOverdue(reminder.dueAt!);
      const priority = this.prioritySorter.calculatePriority(
        {
          importance: reminder.contact.importance,
          frequency: reminder.contact.frequency,
          lastContact: reminder.contact.lastContact,
        },
        daysOverdue,
      );

      return {
        ...reminder,
        priority,
        daysOverdue,
      };
    });

    return this.prioritySorter.sortByPriority(remindersWithPriority as any);
  }

  /**
   * Snooze a reminder until a specific date
   */
  async snoozeReminder(userId: string, reminderId: string, snoozeUntil: Date) {
    const reminder = await this.prisma.reminder.findFirst({
      where: {
        id: reminderId,
        contact: {
          userId,
        },
      },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    if (snoozeUntil <= new Date()) {
      throw new BadRequestException('Snooze date must be in the future');
    }

    return this.prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: ReminderStatus.SNOOZED,
        snoozedUntil: snoozeUntil,
      },
    });
  }

  /**
   * Mark a reminder as done and update contact interaction
   */
  async markReminderDone(userId: string, reminderId: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: {
        id: reminderId,
        contact: {
          userId,
        },
      },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    const now = new Date();

    // Update reminder status
    const updatedReminder = await this.prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: ReminderStatus.COMPLETED,
        completedAt: now,
      },
    });

    // Update contact's last interaction date
    await this.prisma.contact.update({
      where: { id: reminder.contactId },
      data: {
        lastContact: now,
      },
    });

    // Create new reminder if frequency is set
    if (reminder.frequencyDays) {
      const nextDueDate = this.dueDateCalculator.calculateNextDueDate(now, reminder.frequencyDays);
      const priority = this.prioritySorter.calculatePriority(
        {
          importance: 0, // Will be fetched from contact
          frequency: 0,
          lastContact: now,
        },
        0,
      );

      await this.prisma.reminder.create({
        data: {
          contactId: reminder.contactId,
          title: reminder.title,
          message: reminder.message,
          scheduledFor: nextDueDate,
          dueAt: nextDueDate,
          frequencyDays: reminder.frequencyDays,
          priority,
          status: ReminderStatus.PENDING,
        },
      });
    }

    // Update relationship score
    await this.updateRelationshipScore(reminder.contactId);

    return updatedReminder;
  }

  /**
   * Update contact's relationship score based on interaction history
   */
  async updateRelationshipScore(contactId: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        activities: {
          orderBy: {
            occurredAt: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Calculate new frequency score based on recent activities
    const newFrequency = Math.min(contact.frequency + 1, 20);

    // Adjust importance based on interaction consistency
    // This is a simplified algorithm - could be enhanced with AI
    const daysSinceLastContact = contact.lastContact
      ? Math.floor((Date.now() - contact.lastContact.getTime()) / (1000 * 60 * 60 * 24))
      : 365;

    let importanceAdjustment = 0;
    if (daysSinceLastContact < 7) {
      importanceAdjustment = 5;
    } else if (daysSinceLastContact < 30) {
      importanceAdjustment = 2;
    } else if (daysSinceLastContact > 90) {
      importanceAdjustment = -5;
    }

    const newImportance = Math.max(0, Math.min(100, contact.importance + importanceAdjustment));

    return this.prisma.contact.update({
      where: { id: contactId },
      data: {
        frequency: newFrequency,
        importance: newImportance,
      },
    });
  }

  /**
   * Get a specific reminder
   */
  async getReminder(userId: string, reminderId: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: {
        id: reminderId,
        contact: {
          userId,
        },
      },
      include: {
        contact: true,
      },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    return reminder;
  }

  /**
   * Update a reminder
   */
  async updateReminder(userId: string, reminderId: string, dto: UpdateReminderDto) {
    const reminder = await this.getReminder(userId, reminderId);

    const updateData: any = {};

    if (dto.title) updateData.title = dto.title;
    if (dto.message) updateData.message = dto.message;
    if (dto.scheduledFor) updateData.scheduledFor = dto.scheduledFor;

    if (dto.frequencyDays !== undefined) {
      updateData.frequencyDays = dto.frequencyDays;
      const contact = await this.prisma.contact.findUnique({
        where: { id: reminder.contactId },
      });
      if (contact) {
        updateData.dueAt = this.dueDateCalculator.calculateNextDueDate(
          contact.lastContact,
          dto.frequencyDays,
        );
      }
    }

    return this.prisma.reminder.update({
      where: { id: reminderId },
      data: updateData,
      include: {
        contact: true,
      },
    });
  }

  /**
   * Delete a reminder
   */
  async deleteReminder(userId: string, reminderId: string) {
    const reminder = await this.getReminder(userId, reminderId);

    return this.prisma.reminder.delete({
      where: { id: reminder.id },
    });
  }
}
