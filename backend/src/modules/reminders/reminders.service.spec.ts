import { Test, TestingModule } from '@nestjs/testing';
import { RemindersService } from './reminders.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { DueDateCalculatorService } from './services/due-date-calculator.service';
import { PrioritySorterService } from './services/priority-sorter.service';
import { ReminderStatus } from '@prisma/client';

describe('RemindersService', () => {
  let service: RemindersService;
  let prismaService: PrismaService;
  let dueDateCalculator: DueDateCalculatorService;
  let prioritySorter: PrioritySorterService;

  const mockPrismaService = {
    reminder: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockDueDateCalculator = {
    calculateNextDueDate: jest.fn(),
    isOverdue: jest.fn(),
    getDaysOverdue: jest.fn(),
    getTimeframeEndDate: jest.fn(),
  };

  const mockPrioritySorter = {
    calculatePriority: jest.fn(),
    sortByPriority: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: DueDateCalculatorService,
          useValue: mockDueDateCalculator,
        },
        {
          provide: PrioritySorterService,
          useValue: mockPrioritySorter,
        },
      ],
    }).compile();

    service = module.get<RemindersService>(RemindersService);
    prismaService = module.get<PrismaService>(PrismaService);
    dueDateCalculator = module.get<DueDateCalculatorService>(DueDateCalculatorService);
    prioritySorter = module.get<PrioritySorterService>(PrioritySorterService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('setReminderFrequency', () => {
    it('should set reminder frequency for a contact', async () => {
      const contactId = 'contact-1';
      const frequencyDays = 7; // Weekly
      const mockContact = {
        id: contactId,
        firstName: 'John',
        lastContact: new Date('2025-11-20'),
        importance: 50,
        frequency: 10,
      };
      const mockDueDate = new Date('2025-11-27');
      const mockPriority = 50;

      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);
      mockPrismaService.reminder.findFirst.mockResolvedValue(null); // No existing reminder
      mockDueDateCalculator.calculateNextDueDate.mockReturnValue(mockDueDate);
      mockPrioritySorter.calculatePriority.mockReturnValue(mockPriority);
      mockPrismaService.reminder.create.mockResolvedValue({
        id: 'reminder-1',
        contactId,
        frequencyDays,
        dueAt: mockDueDate,
        priority: mockPriority,
      });

      const result = await service.setReminderFrequency(contactId, frequencyDays);

      expect(mockDueDateCalculator.calculateNextDueDate).toHaveBeenCalledWith(
        mockContact.lastContact,
        frequencyDays,
      );
      expect(mockPrioritySorter.calculatePriority).toHaveBeenCalled();
      expect(mockPrismaService.reminder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactId,
          frequencyDays,
          dueAt: mockDueDate,
          priority: mockPriority,
        }),
      });
      expect(result).toHaveProperty('id', 'reminder-1');
    });

    it('should update existing reminder frequency if one exists', async () => {
      const contactId = 'contact-1';
      const frequencyDays = 30; // Monthly
      const mockContact = {
        id: contactId,
        firstName: 'John',
        lastContact: new Date('2025-11-20'),
        importance: 50,
        frequency: 10,
      };
      const existingReminder = {
        id: 'reminder-1',
        contactId,
        frequencyDays: 7,
      };
      const mockDueDate = new Date('2025-12-29');
      const mockPriority = 60;

      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);
      mockPrismaService.reminder.findFirst.mockResolvedValue(existingReminder);
      mockDueDateCalculator.calculateNextDueDate.mockReturnValue(mockDueDate);
      mockPrioritySorter.calculatePriority.mockReturnValue(mockPriority);
      mockPrismaService.reminder.update.mockResolvedValue({
        ...existingReminder,
        frequencyDays,
        dueAt: mockDueDate,
        priority: mockPriority,
      });

      const result = await service.setReminderFrequency(contactId, frequencyDays);

      expect(mockPrismaService.reminder.update).toHaveBeenCalledWith({
        where: { id: existingReminder.id },
        data: expect.objectContaining({
          frequencyDays,
          dueAt: mockDueDate,
          priority: mockPriority,
        }),
      });
      expect(result.frequencyDays).toBe(frequencyDays);
    });
  });

  describe('bulkSetFrequency', () => {
    it('should set frequency for multiple contacts by tag', async () => {
      const tags = ['important', 'vip'];
      const frequencyDays = 7;
      const mockContacts = [
        {
          id: 'contact-1',
          firstName: 'John',
          tags: ['important'],
          lastContact: new Date('2025-11-20'),
          importance: 50,
          frequency: 10,
        },
        {
          id: 'contact-2',
          firstName: 'Jane',
          tags: ['vip'],
          lastContact: new Date('2025-11-22'),
          importance: 60,
          frequency: 12,
        },
      ];

      mockPrismaService.contact.findMany.mockResolvedValue(mockContacts);
      mockPrismaService.contact.findUnique.mockImplementation((args) => {
        return Promise.resolve(mockContacts.find((c) => c.id === args.where.id));
      });
      mockPrismaService.reminder.findFirst.mockResolvedValue(null);
      mockDueDateCalculator.calculateNextDueDate.mockReturnValue(new Date('2025-11-27'));
      mockPrioritySorter.calculatePriority.mockReturnValue(50);
      mockPrismaService.reminder.create.mockResolvedValue({ id: 'reminder-1' });

      const result = await service.bulkSetFrequency(tags, frequencyDays);

      expect(mockPrismaService.contact.findMany).toHaveBeenCalledWith({
        where: {
          tags: {
            hasSome: tags,
          },
        },
      });
      expect(mockPrismaService.reminder.create).toHaveBeenCalledTimes(mockContacts.length);
      expect(result).toHaveProperty('count', mockContacts.length);
    });

    it('should handle empty result when no contacts match tags', async () => {
      const tags = ['nonexistent'];
      const frequencyDays = 7;

      mockPrismaService.contact.findMany.mockResolvedValue([]);

      const result = await service.bulkSetFrequency(tags, frequencyDays);

      expect(result).toHaveProperty('count', 0);
      expect(mockPrismaService.reminder.create).not.toHaveBeenCalled();
    });
  });

  describe('getDueReminders', () => {
    it('should return reminders due within specified timeframe', async () => {
      const userId = 'user-1';
      const filter = 'week';
      const mockReminders = [
        {
          id: 'reminder-1',
          contactId: 'contact-1',
          dueAt: new Date('2025-11-30'),
          status: ReminderStatus.PENDING,
          priority: 80,
          contact: {
            id: 'contact-1',
            firstName: 'John',
            importance: 85,
            frequency: 12,
            lastContact: new Date('2025-11-28'),
          },
        },
        {
          id: 'reminder-2',
          contactId: 'contact-2',
          dueAt: new Date('2025-12-01'),
          status: ReminderStatus.PENDING,
          priority: 60,
          contact: {
            id: 'contact-2',
            firstName: 'Jane',
            importance: 70,
            frequency: 10,
            lastContact: new Date('2025-11-27'),
          },
        },
      ];

      mockDueDateCalculator.getTimeframeEndDate.mockReturnValue(new Date('2025-12-06'));
      mockDueDateCalculator.getDaysOverdue.mockReturnValue(0);
      mockPrioritySorter.calculatePriority.mockReturnValue(80);
      mockPrismaService.reminder.findMany.mockResolvedValue(mockReminders);
      mockPrioritySorter.sortByPriority.mockReturnValue(mockReminders);

      const result = await service.getDueReminders(userId, filter);

      expect(mockPrismaService.reminder.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          contact: {
            userId,
          },
          status: {
            in: [ReminderStatus.PENDING, ReminderStatus.SNOOZED],
          },
          dueAt: {
            lte: expect.any(Date),
          },
        }),
        include: {
          contact: true,
        },
      });
      expect(mockPrioritySorter.sortByPriority).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should filter reminders by day', async () => {
      const userId = 'user-1';
      const filter = 'day';

      mockDueDateCalculator.getTimeframeEndDate.mockReturnValue(new Date('2025-11-30'));
      mockPrismaService.reminder.findMany.mockResolvedValue([]);
      mockPrioritySorter.sortByPriority.mockReturnValue([]);

      await service.getDueReminders(userId, filter);

      expect(mockDueDateCalculator.getTimeframeEndDate).toHaveBeenCalledWith(filter);
      expect(mockPrismaService.reminder.findMany).toHaveBeenCalled();
    });
  });

  describe('getOverdueReminders', () => {
    it('should return only overdue reminders', async () => {
      const userId = 'user-1';
      const now = new Date();
      const mockOverdueReminders = [
        {
          id: 'reminder-1',
          contactId: 'contact-1',
          dueAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          status: ReminderStatus.PENDING,
          priority: 90,
          contact: {
            id: 'contact-1',
            firstName: 'John',
            importance: 85,
            frequency: 12,
            lastContact: new Date('2025-11-20'),
          },
        },
      ];

      mockPrismaService.reminder.findMany.mockResolvedValue(mockOverdueReminders);
      mockDueDateCalculator.getDaysOverdue.mockReturnValue(2);
      mockPrioritySorter.calculatePriority.mockReturnValue(90);
      mockPrioritySorter.sortByPriority.mockReturnValue(mockOverdueReminders);

      const result = await service.getOverdueReminders(userId);

      expect(mockPrismaService.reminder.findMany).toHaveBeenCalledWith({
        where: {
          contact: {
            userId,
          },
          status: {
            in: [ReminderStatus.PENDING, ReminderStatus.SNOOZED],
          },
          dueAt: {
            lt: expect.any(Date),
          },
        },
        include: {
          contact: true,
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('snoozeReminder', () => {
    it('should snooze reminder until specified date', async () => {
      const userId = 'user-1';
      const reminderId = 'reminder-1';
      const snoozeUntil = new Date('2025-12-05');
      const mockReminder = {
        id: reminderId,
        contactId: 'contact-1',
        status: ReminderStatus.PENDING,
        contact: {
          userId,
        },
      };

      mockPrismaService.reminder.findFirst.mockResolvedValue(mockReminder);
      mockPrismaService.reminder.update.mockResolvedValue({
        ...mockReminder,
        status: ReminderStatus.SNOOZED,
        snoozedUntil: snoozeUntil,
      });

      const result = await service.snoozeReminder(userId, reminderId, snoozeUntil);

      expect(mockPrismaService.reminder.update).toHaveBeenCalledWith({
        where: { id: reminderId },
        data: {
          status: ReminderStatus.SNOOZED,
          snoozedUntil: snoozeUntil,
        },
      });
      expect(result.status).toBe(ReminderStatus.SNOOZED);
      expect(result.snoozedUntil).toEqual(snoozeUntil);
    });

    it('should throw error if reminder not found', async () => {
      const userId = 'user-1';
      const reminderId = 'nonexistent';
      const snoozeUntil = new Date('2025-12-05');

      mockPrismaService.reminder.findFirst.mockResolvedValue(null);

      await expect(service.snoozeReminder(userId, reminderId, snoozeUntil)).rejects.toThrow();
    });
  });

  describe('markReminderDone', () => {
    it('should mark reminder as completed and update contact lastContact', async () => {
      const userId = 'user-1';
      const reminderId = 'reminder-1';
      const contactId = 'contact-1';
      const mockReminder = {
        id: reminderId,
        contactId,
        status: ReminderStatus.PENDING,
        frequencyDays: null,
        contact: {
          userId,
        },
      };
      const mockContact = {
        id: contactId,
        importance: 50,
        frequency: 10,
        lastContact: new Date('2025-11-20'),
        activities: [],
      };
      const now = new Date();

      mockPrismaService.reminder.findFirst.mockResolvedValue(mockReminder);
      mockPrismaService.reminder.update.mockResolvedValue({
        ...mockReminder,
        status: ReminderStatus.COMPLETED,
        completedAt: now,
      });
      mockPrismaService.contact.update.mockResolvedValue({
        id: contactId,
        lastContact: now,
      });
      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);

      const result = await service.markReminderDone(userId, reminderId);

      expect(mockPrismaService.reminder.update).toHaveBeenCalledWith({
        where: { id: reminderId },
        data: {
          status: ReminderStatus.COMPLETED,
          completedAt: expect.any(Date),
        },
      });
      expect(mockPrismaService.contact.update).toHaveBeenCalled();
      expect(result.status).toBe(ReminderStatus.COMPLETED);
    });

    it('should create new reminder if frequency is set', async () => {
      const userId = 'user-1';
      const reminderId = 'reminder-1';
      const contactId = 'contact-1';
      const frequencyDays = 30;
      const mockReminder = {
        id: reminderId,
        contactId,
        title: 'Follow up',
        message: 'Test message',
        status: ReminderStatus.PENDING,
        frequencyDays,
        contact: {
          userId,
        },
      };
      const mockContact = {
        id: contactId,
        importance: 50,
        frequency: 10,
        lastContact: new Date('2025-11-20'),
        activities: [],
      };
      const now = new Date();
      const nextDueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      mockPrismaService.reminder.findFirst.mockResolvedValue(mockReminder);
      mockDueDateCalculator.calculateNextDueDate.mockReturnValue(nextDueDate);
      mockPrioritySorter.calculatePriority.mockReturnValue(50);
      mockPrismaService.reminder.update.mockResolvedValue({
        ...mockReminder,
        status: ReminderStatus.COMPLETED,
      });
      mockPrismaService.contact.update.mockResolvedValue({
        id: contactId,
        lastContact: now,
      });
      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);
      mockPrismaService.reminder.create.mockResolvedValue({
        id: 'reminder-2',
        contactId,
        frequencyDays,
        dueAt: nextDueDate,
      });

      await service.markReminderDone(userId, reminderId);

      expect(mockPrismaService.reminder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactId,
          frequencyDays,
          dueAt: nextDueDate,
          title: expect.any(String),
          status: ReminderStatus.PENDING,
        }),
      });
    });
  });

  describe('updateRelationshipScore', () => {
    it('should recalculate contact importance score after interaction', async () => {
      const contactId = 'contact-1';
      const mockContact = {
        id: contactId,
        importance: 50,
        frequency: 10,
      };

      mockPrismaService.contact.findUnique = jest.fn().mockResolvedValue(mockContact);
      mockPrismaService.contact.update.mockResolvedValue({
        ...mockContact,
        importance: 60,
        frequency: 11,
      });

      const result = await service.updateRelationshipScore(contactId);

      expect(mockPrismaService.contact.update).toHaveBeenCalledWith({
        where: { id: contactId },
        data: {
          importance: expect.any(Number),
          frequency: expect.any(Number),
        },
      });
      expect(result).toHaveProperty('importance');
    });
  });
});
