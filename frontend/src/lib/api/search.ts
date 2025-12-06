import { apiClient } from './client';
import type {
  SearchResult,
  ContactSearchResult,
  SearchHistoryItem,
  SearchOptions,
} from '@/types/search';

export const searchService = {
  /**
   * Search contacts
   */
  async searchContacts(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult<ContactSearchResult>> {
    const params = new URLSearchParams({ q: query });

    if (options?.fields && options.fields.length > 0) {
      params.append('fields', options.fields.join(','));
    }

    if (options?.fuzzy) {
      params.append('fuzzy', 'true');
    }

    if (options?.highlight !== false) {
      params.append('highlight', 'true');
    }

    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }

    const response = await apiClient.get<SearchResult<ContactSearchResult>>(`/api/v1/search/contacts?${params.toString()}`);
    return response.data;
  },

  /**
   * Get recent searches
   */
  async getRecentSearches(): Promise<SearchHistoryItem[]> {
    const response = await apiClient.get<SearchHistoryItem[]>('/api/v1/search/recent');
    return response.data;
  },

  /**
   * Clear specific search from history
   */
  async clearRecentSearch(searchId: string): Promise<void> {
    await apiClient.delete(`/api/v1/search/recent/${searchId}`);
  },

  /**
   * Clear all search history
   */
  async clearAllRecentSearches(): Promise<void> {
    await apiClient.delete('/api/v1/search/recent');
  },
};
