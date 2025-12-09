import { apiClient } from '../client';

export interface Notification {
  id: string;
  type: 'REMINDER' | 'INSIGHT' | 'INTEGRATION_SYNC' | 'SYSTEM' | 'SUGGESTION';
  title: string;
  message: string;
  metadata?: any;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: Notification[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const notificationsService = {
  getAll: async (params?: { page?: number; limit?: number; isRead?: boolean }) => {
    const { data } = await apiClient.get<NotificationsResponse>('/notifications', { params });
    return data;
  },

  getUnreadCount: async () => {
    const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count');
    return data;
  },

  markAsRead: async (id: string) => {
    const { data } = await apiClient.patch<Notification>(`/notifications/${id}/read`);
    return data;
  },

  markAllAsRead: async () => {
    const { data } = await apiClient.patch<{ count: number }>('/notifications/read-all');
    return data;
  },
};
