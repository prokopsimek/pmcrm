import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardService } from '@/lib/api/services';
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
 * Hook to fetch dashboard statistics
 */
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardService.getStats(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch pending follow-ups
 */
export function usePendingFollowups(params?: GetPendingFollowupsParams) {
  return useQuery<PendingFollowup[]>({
    queryKey: ['dashboard', 'pending-followups', params],
    queryFn: () => dashboardService.getPendingFollowups(params),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to fetch AI recommendations
 */
export function useRecommendations(params?: GetRecommendationsParams) {
  return useQuery<Recommendation[]>({
    queryKey: ['dashboard', 'recommendations', params],
    queryFn: () => dashboardService.getRecommendations(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch recent activity
 */
export function useRecentActivity(params?: GetRecentActivityParams) {
  return useQuery<ActivityItem[]>({
    queryKey: ['dashboard', 'activity', params],
    queryFn: () => dashboardService.getRecentActivity(params),
    staleTime: 1000 * 60 * 1, // 1 minute
  });
}

/**
 * Hook to dismiss a recommendation
 */
export function useDismissRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recommendationId: string) =>
      dashboardService.dismissRecommendation(recommendationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'recommendations'] });
    },
  });
}

/**
 * Hook to snooze a recommendation
 */
export function useSnoozeRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recommendationId, days }: { recommendationId: string; days: number }) =>
      dashboardService.snoozeRecommendation(recommendationId, days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'recommendations'] });
    },
  });
}

/**
 * Hook to provide feedback on a recommendation
 */
export function useFeedbackRecommendation() {
  return useMutation({
    mutationFn: ({ recommendationId, isHelpful }: { recommendationId: string; isHelpful: boolean }) =>
      dashboardService.feedbackRecommendation(recommendationId, isHelpful),
  });
}

/**
 * Hook to mark follow-up as done
 */
export function useMarkFollowupDone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (followupId: string) => dashboardService.markFollowupDone(followupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending-followups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'activity'] });
    },
  });
}

/**
 * Hook to snooze a follow-up
 */
export function useSnoozeFollowup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ followupId, days }: { followupId: string; days: number }) =>
      dashboardService.snoozeFollowup(followupId, days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending-followups'] });
    },
  });
}

/**
 * Main hook to fetch all dashboard data
 */
export function useDashboardData() {
  const stats = useDashboardStats();
  const pendingFollowups = usePendingFollowups({ limit: 10 });
  const recommendations = useRecommendations({ period: 'daily', limit: 5 });
  const recentActivity = useRecentActivity({ limit: 10 });

  return {
    stats,
    pendingFollowups,
    recommendations,
    recentActivity,
    isLoading: stats.isLoading || pendingFollowups.isLoading || recommendations.isLoading || recentActivity.isLoading,
    isError: stats.isError || pendingFollowups.isError || recommendations.isError || recentActivity.isError,
  };
}
