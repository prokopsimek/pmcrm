import { Test, TestingModule } from '@nestjs/testing';
import { DueDateCalculatorService } from './due-date-calculator.service';

describe('DueDateCalculatorService', () => {
  let service: DueDateCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DueDateCalculatorService],
    }).compile();

    service = module.get<DueDateCalculatorService>(DueDateCalculatorService);
  });

  describe('calculateNextDueDate', () => {
    it('should calculate weekly due date (7 days)', () => {
      const lastContact = new Date('2025-11-20');
      const frequencyDays = 7;

      const result = service.calculateNextDueDate(lastContact, frequencyDays);

      const expected = new Date('2025-11-27');
      expect(result.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
    });

    it('should calculate monthly due date (30 days)', () => {
      const lastContact = new Date('2025-11-20');
      const frequencyDays = 30;

      const result = service.calculateNextDueDate(lastContact, frequencyDays);

      const expected = new Date('2025-12-20');
      expect(result.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
    });

    it('should calculate quarterly due date (90 days)', () => {
      const lastContact = new Date('2025-11-20');
      const frequencyDays = 90;

      const result = service.calculateNextDueDate(lastContact, frequencyDays);

      const expected = new Date('2026-02-18');
      expect(result.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
    });

    it('should calculate custom frequency (14 days)', () => {
      const lastContact = new Date('2025-11-20');
      const frequencyDays = 14;

      const result = service.calculateNextDueDate(lastContact, frequencyDays);

      const expected = new Date('2025-12-04');
      expect(result.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
    });

    it('should use current date if lastContact is null', () => {
      const frequencyDays = 7;
      const now = new Date();

      const result = service.calculateNextDueDate(null, frequencyDays);

      const expected = new Date(now.getTime() + frequencyDays * 24 * 60 * 60 * 1000);
      const daysDiff = Math.abs((result.getTime() - expected.getTime()) / (24 * 60 * 60 * 1000));

      // Should be within 1 day (accounting for test execution time)
      expect(daysDiff).toBeLessThan(1);
    });

    it('should handle edge case with year boundary', () => {
      const lastContact = new Date('2025-12-25');
      const frequencyDays = 14;

      const result = service.calculateNextDueDate(lastContact, frequencyDays);

      const expected = new Date('2026-01-08');
      expect(result.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
    });
  });

  describe('isOverdue', () => {
    it('should return true for past due date', () => {
      const dueDate = new Date('2025-11-20');
      const currentDate = new Date('2025-11-25');

      const result = service.isOverdue(dueDate, currentDate);

      expect(result).toBe(true);
    });

    it('should return false for future due date', () => {
      const dueDate = new Date('2025-12-05');
      const currentDate = new Date('2025-11-25');

      const result = service.isOverdue(dueDate, currentDate);

      expect(result).toBe(false);
    });

    it('should return false for due date today', () => {
      const today = new Date('2025-11-29');

      const result = service.isOverdue(today, today);

      expect(result).toBe(false);
    });

    it('should use current date if not provided', () => {
      const pastDate = new Date('2020-01-01');

      const result = service.isOverdue(pastDate);

      expect(result).toBe(true);
    });

    it('should handle null due date', () => {
      const result = service.isOverdue(null);

      expect(result).toBe(false);
    });
  });

  describe('getDaysOverdue', () => {
    it('should calculate days overdue correctly', () => {
      const dueDate = new Date('2025-11-20');
      const currentDate = new Date('2025-11-25');

      const result = service.getDaysOverdue(dueDate, currentDate);

      expect(result).toBe(5);
    });

    it('should return 0 for future due date', () => {
      const dueDate = new Date('2025-12-05');
      const currentDate = new Date('2025-11-25');

      const result = service.getDaysOverdue(dueDate, currentDate);

      expect(result).toBe(0);
    });

    it('should return 0 for due date today', () => {
      const today = new Date('2025-11-29');

      const result = service.getDaysOverdue(today, today);

      expect(result).toBe(0);
    });

    it('should handle large overdue periods', () => {
      const dueDate = new Date('2025-01-01');
      const currentDate = new Date('2025-11-29');

      const result = service.getDaysOverdue(dueDate, currentDate);

      // Should be approximately 332 days (depending on leap year)
      expect(result).toBeGreaterThan(300);
      expect(result).toBeLessThan(365);
    });

    it('should use current date if not provided', () => {
      const pastDate = new Date('2025-11-20');
      const now = new Date();

      const result = service.getDaysOverdue(pastDate);

      // Result should be positive and less than reasonable range
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getTimeframeEndDate', () => {
    it('should calculate end date for day filter', () => {
      const now = new Date('2025-11-29T12:00:00Z');

      const result = service.getTimeframeEndDate('day', now);

      const expected = new Date('2025-11-30T12:00:00Z');
      expect(result.toISOString()).toBe(expected.toISOString());
    });

    it('should calculate end date for week filter', () => {
      const now = new Date('2025-11-29T12:00:00Z');

      const result = service.getTimeframeEndDate('week', now);

      const expected = new Date('2025-12-06T12:00:00Z');
      expect(result.toISOString()).toBe(expected.toISOString());
    });

    it('should calculate end date for month filter', () => {
      const now = new Date('2025-11-29T12:00:00Z');

      const result = service.getTimeframeEndDate('month', now);

      const expected = new Date('2025-12-29T12:00:00Z');
      expect(result.toISOString()).toBe(expected.toISOString());
    });

    it('should default to week if invalid filter provided', () => {
      const now = new Date('2025-11-29T12:00:00Z');

      const result = service.getTimeframeEndDate('invalid' as any, now);

      const expected = new Date('2025-12-06T12:00:00Z');
      expect(result.toISOString()).toBe(expected.toISOString());
    });
  });
});
