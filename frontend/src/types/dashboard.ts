/**
 * Dashboard Types
 */

import { Contact } from './contact';

export interface DashboardStats {
  totalContacts: number;
  dueToday: number;
  overdue: number;
  newThisWeek: number;
  contactsChange?: number; // percentage change
  dueTodayChange?: number;
  overdueChange?: number;
  newThisWeekChange?: number;
}

export interface PendingFollowup {
  id: string;
  contact: Contact;
  dueDate: string;
  lastContactedAt?: string;
  relationshipStrength?: number; // 0-100
  reminderFrequency?: string;
  isPastDue: boolean;
}

export interface ActivityItem {
  id: string;
  type: 'contact_added' | 'email_sent' | 'meeting' | 'integration_connected' | 'note_added' | 'reminder_completed';
  description: string;
  timestamp: string;
  contactId?: string;
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  metadata?: Record<string, unknown>;
}

export interface Recommendation {
  id: string;
  contactId: string;
  contact: Contact;
  reason: string;
  urgencyScore: number;
  triggerType: 'job_change' | 'company_news' | 'birthday' | 'overdue' | 'general';
  createdAt: string;
  dismissedAt?: string;
  snoozedUntil?: string;
}

export interface DashboardData {
  stats: DashboardStats;
  pendingFollowups: PendingFollowup[];
  recommendations: Recommendation[];
  recentActivity: ActivityItem[];
}

export interface GetPendingFollowupsParams {
  limit?: number;
  includeOverdue?: boolean;
}

export interface GetRecommendationsParams {
  period?: 'daily' | 'weekly' | 'monthly';
  limit?: number;
}

export interface GetRecentActivityParams {
  limit?: number;
  offset?: number;
  types?: ActivityItem['type'][];
}
