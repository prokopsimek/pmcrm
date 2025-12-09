import { notificationsService } from '@/lib/api/services';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useNotifications(params?: { page?: number; limit?: number; isRead?: boolean }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationsService.getAll(params),
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const unreadCountQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsService.getUnreadCount,
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: notificationsService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: notificationsService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications: query.data,
    isLoading: query.isLoading,
    unreadCount: unreadCountQuery.data?.count ?? 0,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  };
}
