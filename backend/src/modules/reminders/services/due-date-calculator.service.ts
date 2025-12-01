import { Injectable } from '@nestjs/common';

@Injectable()
export class DueDateCalculatorService {
  /**
   * Calculate the next due date based on last contact date and frequency
   * @param lastContact - Date of last contact (or null to use current date)
   * @param frequencyDays - Number of days between contacts
   * @returns Next due date
   */
  calculateNextDueDate(lastContact: Date | null, frequencyDays: number): Date {
    const baseDate = lastContact || new Date();
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + frequencyDays);
    return dueDate;
  }

  /**
   * Check if a reminder is overdue
   * @param dueDate - The due date to check
   * @param currentDate - Current date (defaults to now)
   * @returns true if overdue, false otherwise
   */
  isOverdue(dueDate: Date | null, currentDate: Date = new Date()): boolean {
    if (!dueDate) {
      return false;
    }
    return dueDate < currentDate;
  }

  /**
   * Calculate how many days a reminder is overdue
   * @param dueDate - The due date
   * @param currentDate - Current date (defaults to now)
   * @returns Number of days overdue (0 if not overdue)
   */
  getDaysOverdue(dueDate: Date, currentDate: Date = new Date()): number {
    if (!this.isOverdue(dueDate, currentDate)) {
      return 0;
    }

    const diffTime = currentDate.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Get the end date for a given timeframe filter
   * @param filter - The timeframe filter ('day', 'week', 'month')
   * @param baseDate - Base date (defaults to now)
   * @returns End date for the timeframe
   */
  getTimeframeEndDate(filter: 'day' | 'week' | 'month', baseDate: Date = new Date()): Date {
    const endDate = new Date(baseDate);

    switch (filter) {
      case 'day':
        endDate.setDate(endDate.getDate() + 1);
        break;
      case 'week':
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'month':
        endDate.setDate(endDate.getDate() + 30);
        break;
      default:
        // Default to week
        endDate.setDate(endDate.getDate() + 7);
    }

    return endDate;
  }
}
