import { apiClient } from '../client';
import type { SavedView, CreateSavedViewInput, UpdateSavedViewInput } from '@/types/saved-view';

/**
 * SavedViews API Service
 * US-061: Advanced Filtering
 *
 * Handles all API calls for saved view management
 */
export const savedViewsService = {
  /**
   * Get all saved views for the current user
   */
  getSavedViews: async (): Promise<{ data: SavedView[]; total: number }> => {
    const response = await apiClient.get<{ data: SavedView[]; total: number }>('/saved-views');
    return response.data;
  },

  /**
   * Get a single saved view by ID
   */
  getSavedView: async (id: string): Promise<SavedView> => {
    const response = await apiClient.get<SavedView>(`/saved-views/${id}`);
    return response.data;
  },

  /**
   * Get the default saved view (if any)
   */
  getDefaultView: async (): Promise<SavedView | null> => {
    const response = await apiClient.get<SavedView | null>('/saved-views/default');
    return response.data;
  },

  /**
   * Create a new saved view
   */
  createSavedView: async (data: CreateSavedViewInput): Promise<SavedView> => {
    const response = await apiClient.post<SavedView>('/saved-views', data);
    return response.data;
  },

  /**
   * Update an existing saved view
   */
  updateSavedView: async (id: string, data: UpdateSavedViewInput): Promise<SavedView> => {
    const response = await apiClient.patch<SavedView>(`/saved-views/${id}`, data);
    return response.data;
  },

  /**
   * Delete a saved view
   */
  deleteSavedView: async (id: string): Promise<void> => {
    await apiClient.delete(`/saved-views/${id}`);
  },

  /**
   * Set a saved view as the default
   */
  setDefaultView: async (id: string): Promise<SavedView> => {
    const response = await apiClient.post<SavedView>(`/saved-views/${id}/set-default`);
    return response.data;
  },
};












