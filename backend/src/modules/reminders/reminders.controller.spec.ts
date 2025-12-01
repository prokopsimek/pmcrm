import { Test, TestingModule } from '@nestjs/testing';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { ReminderStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('RemindersController', () => {
  let controller: RemindersController;
  let service: RemindersService;

  const mockRemindersService = {
    setReminderFrequency: jest.fn(),
    bulkSetFrequency: jest.fn(),
    getDueReminders: jest.fn(),
    getOverdueReminders: jest.fn(),
    snoozeReminder: jest.fn(),
    markReminderDone: jest.fn(),
    createReminder: jest.fn(),
    updateReminder: jest.fn(),
    deleteReminder: jest.fn(),
    getReminder: jest.fn(),
  };

  const mockUser = {
    userId: 'user-1',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RemindersController],
      providers: [
        {
          provide: RemindersService,
          useValue: mockRemindersService,
        },
      ],
    }).compile();

    controller = module.get<RemindersController>(RemindersController);
    service = module.get<RemindersService>(RemindersService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /api/v1/reminders', () => {
    it('should create a new reminder', async () => {
      const createReminderDto = {
        contactId: 'contact-1',
        title: 'Follow up with John',
        message: 'Discuss project updates',
        scheduledFor: new Date('2025-12-01'),
        frequencyDays: 7,
      };

      const mockReminder = {
        id: 'reminder-1',
        ...createReminderDto,
        status: ReminderStatus.PENDING,
        priority: 50,
        createdAt: new Date(),
      };

      mockRemindersService.createReminder.mockResolvedValue(mockReminder);

      const result = await controller.createReminder(mockUser as any, createReminderDto);

      expect(mockRemindersService.createReminder).toHaveBeenCalledWith(
        mockUser.userId,
        createReminderDto,
      );
      expect(result).toEqual(mockReminder);
    });

    it('should throw BadRequestException for invalid data', async () => {
      const invalidDto = {
        contactId: '',
        title: '',
      };

      mockRemindersService.createReminder.mockRejectedValue(
        new BadRequestException('Invalid reminder data'),
      );

      await expect(controller.createReminder(mockUser as any, invalidDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('PUT /api/v1/reminders/:id/frequency', () => {
    it('should update reminder frequency', async () => {
      const reminderId = 'reminder-1';
      const setFrequencyDto = {
        frequencyDays: 30,
      };

      const mockUpdatedReminder = {
        id: reminderId,
        contactId: 'contact-1',
        frequencyDays: 30,
        dueAt: new Date('2025-12-29'),
        priority: 60,
      };

      mockRemindersService.updateReminder.mockResolvedValue(mockUpdatedReminder);

      const result = await controller.updateReminderFrequency(
        mockUser as any,
        reminderId,
        setFrequencyDto,
      );

      expect(mockRemindersService.updateReminder).toHaveBeenCalledWith(
        mockUser.userId,
        reminderId,
        setFrequencyDto,
      );
      expect(result.frequencyDays).toBe(30);
    });

    it('should throw NotFoundException for non-existent reminder', async () => {
      const reminderId = 'nonexistent';
      const setFrequencyDto = { frequencyDays: 7 };

      mockRemindersService.updateReminder.mockRejectedValue(
        new NotFoundException('Reminder not found'),
      );

      await expect(
        controller.updateReminderFrequency(mockUser as any, reminderId, setFrequencyDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /api/v1/reminders/bulk/frequency', () => {
    it('should bulk update frequency for contacts by tags', async () => {
      const bulkFrequencyDto = {
        tags: ['important', 'vip'],
        frequencyDays: 7,
      };

      const mockResult = {
        count: 5,
        reminders: [
          { id: 'reminder-1', contactId: 'contact-1' },
          { id: 'reminder-2', contactId: 'contact-2' },
        ],
      };

      mockRemindersService.bulkSetFrequency.mockResolvedValue(mockResult);

      const result = await controller.bulkSetFrequency(mockUser as any, bulkFrequencyDto);

      expect(mockRemindersService.bulkSetFrequency).toHaveBeenCalledWith(
        bulkFrequencyDto.tags,
        bulkFrequencyDto.frequencyDays,
      );
      expect(result.count).toBe(5);
    });

    it('should return empty result when no contacts match tags', async () => {
      const bulkFrequencyDto = {
        tags: ['nonexistent'],
        frequencyDays: 7,
      };

      mockRemindersService.bulkSetFrequency.mockResolvedValue({ count: 0, reminders: [] });

      const result = await controller.bulkSetFrequency(mockUser as any, bulkFrequencyDto);

      expect(result.count).toBe(0);
    });
  });

  describe('GET /api/v1/reminders/dashboard', () => {
    it('should return dashboard with due reminders for week filter', async () => {
      const filter = 'week';
      const mockReminders = [
        {
          id: 'reminder-1',
          contactId: 'contact-1',
          dueAt: new Date('2025-11-30'),
          priority: 80,
          status: ReminderStatus.PENDING,
          contact: {
            id: 'contact-1',
            firstName: 'John',
            lastName: 'Doe',
            importance: 85,
            frequency: 12,
          },
        },
        {
          id: 'reminder-2',
          contactId: 'contact-2',
          dueAt: new Date('2025-12-01'),
          priority: 60,
          status: ReminderStatus.PENDING,
          contact: {
            id: 'contact-2',
            firstName: 'Jane',
            lastName: 'Smith',
            importance: 70,
            frequency: 10,
          },
        },
      ];

      mockRemindersService.getDueReminders.mockResolvedValue(mockReminders);

      const result = await controller.getDashboard(mockUser as any, filter);

      expect(mockRemindersService.getDueReminders).toHaveBeenCalledWith(mockUser.userId, filter);
      expect(result).toHaveLength(2);
      expect(result[0].priority).toBe(80);
    });

    it('should return dashboard for day filter', async () => {
      const filter = 'day';

      mockRemindersService.getDueReminders.mockResolvedValue([]);

      const result = await controller.getDashboard(mockUser as any, filter);

      expect(mockRemindersService.getDueReminders).toHaveBeenCalledWith(mockUser.userId, filter);
      expect(result).toEqual([]);
    });

    it('should return dashboard for month filter', async () => {
      const filter = 'month';

      mockRemindersService.getDueReminders.mockResolvedValue([]);

      await controller.getDashboard(mockUser as any, filter);

      expect(mockRemindersService.getDueReminders).toHaveBeenCalledWith(mockUser.userId, filter);
    });

    it('should default to week filter if not provided', async () => {
      mockRemindersService.getDueReminders.mockResolvedValue([]);

      await controller.getDashboard(mockUser as any);

      expect(mockRemindersService.getDueReminders).toHaveBeenCalledWith(mockUser.userId, 'week');
    });
  });

  describe('GET /api/v1/reminders/overdue', () => {
    it('should return overdue reminders', async () => {
      const mockOverdueReminders = [
        {
          id: 'reminder-1',
          contactId: 'contact-1',
          dueAt: new Date('2025-11-20'),
          priority: 90,
          status: ReminderStatus.PENDING,
        },
      ];

      mockRemindersService.getOverdueReminders.mockResolvedValue(mockOverdueReminders);

      const result = await controller.getOverdueReminders(mockUser as any);

      expect(mockRemindersService.getOverdueReminders).toHaveBeenCalledWith(mockUser.userId);
      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(90);
    });
  });

  describe('POST /api/v1/reminders/:id/snooze', () => {
    it('should snooze a reminder', async () => {
      const reminderId = 'reminder-1';
      const snoozeDto = {
        snoozeUntil: new Date('2025-12-05'),
      };

      const mockSnoozedReminder = {
        id: reminderId,
        status: ReminderStatus.SNOOZED,
        snoozedUntil: snoozeDto.snoozeUntil,
      };

      mockRemindersService.snoozeReminder.mockResolvedValue(mockSnoozedReminder);

      const result = await controller.snoozeReminder(mockUser as any, reminderId, snoozeDto);

      expect(mockRemindersService.snoozeReminder).toHaveBeenCalledWith(
        mockUser.userId,
        reminderId,
        snoozeDto.snoozeUntil,
      );
      expect(result.status).toBe(ReminderStatus.SNOOZED);
    });

    it('should throw NotFoundException for invalid reminder', async () => {
      const reminderId = 'nonexistent';
      const snoozeDto = {
        snoozeUntil: new Date('2025-12-05'),
      };

      mockRemindersService.snoozeReminder.mockRejectedValue(
        new NotFoundException('Reminder not found'),
      );

      await expect(
        controller.snoozeReminder(mockUser as any, reminderId, snoozeDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate snooze date is in the future', async () => {
      const reminderId = 'reminder-1';
      const snoozeDto = {
        snoozeUntil: new Date('2020-01-01'), // Past date
      };

      mockRemindersService.snoozeReminder.mockRejectedValue(
        new BadRequestException('Snooze date must be in the future'),
      );

      await expect(
        controller.snoozeReminder(mockUser as any, reminderId, snoozeDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /api/v1/reminders/:id/done', () => {
    it('should mark reminder as done', async () => {
      const reminderId = 'reminder-1';

      const mockCompletedReminder = {
        id: reminderId,
        status: ReminderStatus.COMPLETED,
        completedAt: new Date(),
      };

      mockRemindersService.markReminderDone.mockResolvedValue(mockCompletedReminder);

      const result = await controller.markReminderDone(mockUser as any, reminderId);

      expect(mockRemindersService.markReminderDone).toHaveBeenCalledWith(
        mockUser.userId,
        reminderId,
      );
      expect(result.status).toBe(ReminderStatus.COMPLETED);
      expect(result.completedAt).toBeDefined();
    });

    it('should update relationship score when marking done', async () => {
      const reminderId = 'reminder-1';

      const mockCompletedReminder = {
        id: reminderId,
        contactId: 'contact-1',
        status: ReminderStatus.COMPLETED,
      };

      mockRemindersService.markReminderDone.mockResolvedValue(mockCompletedReminder);

      await controller.markReminderDone(mockUser as any, reminderId);

      expect(mockRemindersService.markReminderDone).toHaveBeenCalledWith(
        mockUser.userId,
        reminderId,
      );
    });

    it('should throw NotFoundException for invalid reminder', async () => {
      const reminderId = 'nonexistent';

      mockRemindersService.markReminderDone.mockRejectedValue(
        new NotFoundException('Reminder not found'),
      );

      await expect(controller.markReminderDone(mockUser as any, reminderId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('GET /api/v1/reminders/:id', () => {
    it('should get a specific reminder', async () => {
      const reminderId = 'reminder-1';
      const mockReminder = {
        id: reminderId,
        contactId: 'contact-1',
        title: 'Follow up',
        status: ReminderStatus.PENDING,
      };

      mockRemindersService.getReminder.mockResolvedValue(mockReminder);

      const result = await controller.getReminder(mockUser as any, reminderId);

      expect(mockRemindersService.getReminder).toHaveBeenCalledWith(mockUser.userId, reminderId);
      expect(result).toEqual(mockReminder);
    });

    it('should throw NotFoundException for non-existent reminder', async () => {
      const reminderId = 'nonexistent';

      mockRemindersService.getReminder.mockRejectedValue(
        new NotFoundException('Reminder not found'),
      );

      await expect(controller.getReminder(mockUser as any, reminderId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('DELETE /api/v1/reminders/:id', () => {
    it('should delete a reminder', async () => {
      const reminderId = 'reminder-1';

      mockRemindersService.deleteReminder.mockResolvedValue({ id: reminderId });

      const result = await controller.deleteReminder(mockUser as any, reminderId);

      expect(mockRemindersService.deleteReminder).toHaveBeenCalledWith(mockUser.userId, reminderId);
      expect(result).toHaveProperty('id', reminderId);
    });

    it('should throw NotFoundException for non-existent reminder', async () => {
      const reminderId = 'nonexistent';

      mockRemindersService.deleteReminder.mockRejectedValue(
        new NotFoundException('Reminder not found'),
      );

      await expect(controller.deleteReminder(mockUser as any, reminderId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
