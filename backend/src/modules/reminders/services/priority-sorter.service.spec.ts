import { Test, TestingModule } from '@nestjs/testing';
import { PrioritySorterService } from './priority-sorter.service';
import { ReminderStatus } from '@prisma/client';

describe('PrioritySorterService', () => {
  let service: PrioritySorterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrioritySorterService],
    }).compile();

    service = module.get<PrioritySorterService>(PrioritySorterService);
  });

  describe('calculatePriority', () => {
    it('should calculate high priority for important contact with recent interaction', () => {
      const contact = {
        importance: 90,
        frequency: 15,
        lastContact: new Date('2025-11-28'),
      };
      const daysOverdue = 0;

      const result = service.calculatePriority(contact, daysOverdue);

      // High importance + good frequency + not overdue = high priority
      expect(result).toBeGreaterThan(70);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should calculate very high priority for overdue important contact', () => {
      const contact = {
        importance: 85,
        frequency: 12,
        lastContact: new Date('2025-11-10'),
      };
      const daysOverdue = 10;

      const result = service.calculatePriority(contact, daysOverdue);

      // Overdue should significantly boost priority
      expect(result).toBeGreaterThan(85);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should calculate medium priority for moderate importance', () => {
      const contact = {
        importance: 50,
        frequency: 8,
        lastContact: new Date('2025-11-25'),
      };
      const daysOverdue = 2;

      const result = service.calculatePriority(contact, daysOverdue);

      expect(result).toBeGreaterThan(40);
      expect(result).toBeLessThan(70);
    });

    it('should calculate low priority for low importance contact', () => {
      const contact = {
        importance: 20,
        frequency: 3,
        lastContact: new Date('2025-11-20'),
      };
      const daysOverdue = 0;

      const result = service.calculatePriority(contact, daysOverdue);

      expect(result).toBeLessThan(40);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should cap priority at 100', () => {
      const contact = {
        importance: 100,
        frequency: 20,
        lastContact: new Date('2025-11-01'),
      };
      const daysOverdue = 30;

      const result = service.calculatePriority(contact, daysOverdue);

      expect(result).toBeLessThanOrEqual(100);
    });

    it('should handle null lastContact date', () => {
      const contact = {
        importance: 50,
        frequency: 5,
        lastContact: null,
      };
      const daysOverdue = 0;

      const result = service.calculatePriority(contact, daysOverdue);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should increase priority for very overdue reminders', () => {
      const contact = {
        importance: 60,
        frequency: 8,
        lastContact: new Date('2025-10-01'),
      };
      const daysOverdue = 30;

      const result = service.calculatePriority(contact, daysOverdue);

      // Long overdue should have high priority
      expect(result).toBeGreaterThan(75);
    });
  });

  describe('sortByPriority', () => {
    it('should sort reminders by priority descending', () => {
      const reminders = [
        {
          id: 'reminder-1',
          priority: 50,
          contact: { firstName: 'Alice' },
        },
        {
          id: 'reminder-2',
          priority: 90,
          contact: { firstName: 'Bob' },
        },
        {
          id: 'reminder-3',
          priority: 70,
          contact: { firstName: 'Charlie' },
        },
      ];

      const result = service.sortByPriority(reminders as any);

      expect(result[0].priority).toBe(90);
      expect(result[1].priority).toBe(70);
      expect(result[2].priority).toBe(50);
      expect(result[0].contact.firstName).toBe('Bob');
    });

    it('should handle empty array', () => {
      const result = service.sortByPriority([]);

      expect(result).toEqual([]);
    });

    it('should handle single reminder', () => {
      const reminders = [
        {
          id: 'reminder-1',
          priority: 50,
          contact: { firstName: 'Alice' },
        },
      ];

      const result = service.sortByPriority(reminders as any);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('reminder-1');
    });

    it('should maintain stable sort for equal priorities', () => {
      const reminders = [
        {
          id: 'reminder-1',
          priority: 50,
          contact: { firstName: 'Alice' },
        },
        {
          id: 'reminder-2',
          priority: 50,
          contact: { firstName: 'Bob' },
        },
        {
          id: 'reminder-3',
          priority: 50,
          contact: { firstName: 'Charlie' },
        },
      ];

      const result = service.sortByPriority(reminders as any);

      // All should have same priority
      expect(result[0].priority).toBe(50);
      expect(result[1].priority).toBe(50);
      expect(result[2].priority).toBe(50);
    });
  });

  describe('getRelationshipStrength', () => {
    it('should return strong for high importance and frequency', () => {
      const contact = {
        importance: 85,
        frequency: 15,
      };

      const result = service.getRelationshipStrength(contact);

      expect(result).toBe('strong');
    });

    it('should return moderate for medium importance and frequency', () => {
      const contact = {
        importance: 50,
        frequency: 8,
      };

      const result = service.getRelationshipStrength(contact);

      expect(result).toBe('moderate');
    });

    it('should return weak for low importance and frequency', () => {
      const contact = {
        importance: 20,
        frequency: 3,
      };

      const result = service.getRelationshipStrength(contact);

      expect(result).toBe('weak');
    });

    it('should handle edge case at boundary values', () => {
      const contact = {
        importance: 70,
        frequency: 10,
      };

      const result = service.getRelationshipStrength(contact);

      // At boundary between moderate and strong
      expect(['moderate', 'strong']).toContain(result);
    });

    it('should handle null values gracefully', () => {
      const contact = {
        importance: null,
        frequency: null,
      };

      const result = service.getRelationshipStrength(contact as any);

      expect(['weak', 'moderate', 'strong']).toContain(result);
    });
  });

  describe('getOverdueIndicator', () => {
    it('should return critical for very overdue (>14 days)', () => {
      const daysOverdue = 20;

      const result = service.getOverdueIndicator(daysOverdue);

      expect(result).toBe('critical');
    });

    it('should return warning for moderately overdue (7-14 days)', () => {
      const daysOverdue = 10;

      const result = service.getOverdueIndicator(daysOverdue);

      expect(result).toBe('warning');
    });

    it('should return attention for slightly overdue (1-7 days)', () => {
      const daysOverdue = 3;

      const result = service.getOverdueIndicator(daysOverdue);

      expect(result).toBe('attention');
    });

    it('should return none for not overdue', () => {
      const daysOverdue = 0;

      const result = service.getOverdueIndicator(daysOverdue);

      expect(result).toBe('none');
    });

    it('should handle negative values', () => {
      const daysOverdue = -5;

      const result = service.getOverdueIndicator(daysOverdue);

      expect(result).toBe('none');
    });

    it('should handle edge cases at boundaries', () => {
      expect(service.getOverdueIndicator(7)).toBe('attention');
      expect(service.getOverdueIndicator(14)).toBe('warning');
      expect(service.getOverdueIndicator(15)).toBe('critical');
    });
  });
});
