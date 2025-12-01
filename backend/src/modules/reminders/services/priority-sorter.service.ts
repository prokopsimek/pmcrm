import { Injectable } from '@nestjs/common';

export interface ContactForPriority {
  importance: number;
  frequency: number;
  lastContact?: Date | null;
}

export interface ReminderWithContact {
  id: string;
  priority: number;
  contact?: ContactForPriority;
  [key: string]: any;
}

@Injectable()
export class PrioritySorterService {
  /**
   * Calculate priority score for a reminder
   * Priority is based on:
   * - Contact importance (0-100)
   * - Contact frequency/interaction history (0-20)
   * - Days overdue (adds urgency)
   * @param contact - Contact information
   * @param daysOverdue - Number of days overdue
   * @returns Priority score (0-100)
   */
  calculatePriority(contact: ContactForPriority, daysOverdue: number): number {
    // Base priority from contact importance (0-100 scale)
    let priority = contact.importance || 0;

    // Add frequency bonus (up to 20 points)
    const frequencyBonus = Math.min((contact.frequency || 0) * 1.5, 20);
    priority += frequencyBonus;

    // Add overdue penalty (increases priority)
    // Each day overdue adds 2 points, capped at 30 points
    const overduePenalty = Math.min(daysOverdue * 2, 30);
    priority += overduePenalty;

    // Cap at 100
    return Math.min(Math.round(priority), 100);
  }

  /**
   * Sort reminders by priority in descending order
   * @param reminders - Array of reminders with priority scores
   * @returns Sorted array of reminders
   */
  sortByPriority(reminders: ReminderWithContact[]): ReminderWithContact[] {
    return [...reminders].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get relationship strength indicator based on importance and frequency
   * @param contact - Contact information
   * @returns Relationship strength ('weak', 'moderate', 'strong')
   */
  getRelationshipStrength(contact: ContactForPriority): 'weak' | 'moderate' | 'strong' {
    const importance = contact.importance || 0;
    const frequency = contact.frequency || 0;

    const combinedScore = importance + frequency;

    if (combinedScore >= 90) {
      return 'strong';
    } else if (combinedScore >= 50) {
      return 'moderate';
    } else {
      return 'weak';
    }
  }

  /**
   * Get visual indicator for overdue status
   * @param daysOverdue - Number of days overdue
   * @returns Indicator level ('none', 'attention', 'warning', 'critical')
   */
  getOverdueIndicator(daysOverdue: number): 'none' | 'attention' | 'warning' | 'critical' {
    if (daysOverdue <= 0) {
      return 'none';
    } else if (daysOverdue <= 7) {
      return 'attention';
    } else if (daysOverdue <= 14) {
      return 'warning';
    } else {
      return 'critical';
    }
  }
}
