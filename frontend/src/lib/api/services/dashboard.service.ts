import { apiClient } from '../client';
import type {
  DashboardStats,
  PendingFollowup,
  Recommendation,
  ActivityItem,
  GetPendingFollowupsParams,
  GetRecommendationsParams,
  GetRecentActivityParams,
} from '@/types';

/**
 * Dashboard API Service
 */
export const dashboardService = {
  /**
   * Get dashboard statistics
   */
  getStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get<DashboardStats>('/dashboard/stats');
    return response.data;
  },

  /**
   * Get pending follow-ups
   */
  getPendingFollowups: async (params?: GetPendingFollowupsParams): Promise<PendingFollowup[]> => {
    const response = await apiClient.get<PendingFollowup[]>('/dashboard/followups', params as Record<string, unknown>);
    return response.data;
  },

  /**
   * Get AI recommendations
   */
  getRecommendations: async (params?: GetRecommendationsParams): Promise<Recommendation[]> => {
    const response = await apiClient.get<Recommendation[]>('/dashboard/recommendations', params as Record<string, unknown>);
    return response.data;
  },

  /**
   * Get recent activity
   */
  getRecentActivity: async (params?: GetRecentActivityParams): Promise<ActivityItem[]> => {
    const response = await apiClient.get<ActivityItem[]>('/dashboard/activity', params as Record<string, unknown>);
    return response.data;
  },

  /**
   * Dismiss a recommendation
   */
  dismissRecommendation: async (recommendationId: string): Promise<void> => {
    await apiClient.post(`/dashboard/recommendations/${recommendationId}/dismiss`);
  },

  /**
   * Snooze a recommendation
   */
  snoozeRecommendation: async (recommendationId: string, days: number): Promise<void> => {
    await apiClient.post(`/dashboard/recommendations/${recommendationId}/snooze`, { days });
  },

  /**
   * Provide feedback on a recommendation
   */
  feedbackRecommendation: async (recommendationId: string, isHelpful: boolean): Promise<void> => {
    await apiClient.post(`/dashboard/recommendations/${recommendationId}/feedback`, { isHelpful });
  },

  /**
   * Mark follow-up as done
   */
  markFollowupDone: async (followupId: string): Promise<void> => {
    await apiClient.post(`/dashboard/followups/${followupId}/complete`);
  },

  /**
   * Snooze a follow-up
   */
  snoozeFollowup: async (followupId: string, days: number): Promise<void> => {
    await apiClient.post(`/dashboard/followups/${followupId}/snooze`, { days });
  },
};
