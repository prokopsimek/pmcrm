import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';
import { queryKeys } from '@/lib/react-query';
import { searchService } from '@/lib/api/search';
import type {
  SearchResult,
  ContactSearchResult,
  SearchHistoryItem,
  SearchOptions,
} from '@/types/search';

/**
 * Hook for searching contacts with debouncing
 */
export function useSearch(initialQuery: string = '', options?: SearchOptions) {
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(initialQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [initialQuery]);

  return useQuery<SearchResult<ContactSearchResult>>({
    queryKey: queryKeys.search.contacts(debouncedQuery, options as Record<string, unknown>),
    queryFn: () => searchService.searchContacts(debouncedQuery, options),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook for instant search without debouncing
 */
export function useInstantSearch(query: string, options?: SearchOptions) {
  return useQuery<SearchResult<ContactSearchResult>>({
    queryKey: queryKeys.search.contacts(query, options as Record<string, unknown>),
    queryFn: () => searchService.searchContacts(query, options),
    enabled: query.length >= 2,
    staleTime: 30000,
  });
}

/**
 * Hook for recent search history
 */
export function useRecentSearches() {
  return useQuery<SearchHistoryItem[]>({
    queryKey: queryKeys.search.recent(),
    queryFn: () => searchService.getRecentSearches(),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook for clearing search history
 */
export function useClearSearchHistory() {
  const queryClient = useQueryClient();

  const clearOne = useMutation({
    mutationFn: (searchId: string) => searchService.clearRecentSearch(searchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.search.recent() });
    },
  });

  const clearAll = useMutation({
    mutationFn: () => searchService.clearAllRecentSearches(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.search.recent() });
    },
  });

  return { clearOne, clearAll };
}

/**
 * Hook for managing search state
 */
export function useSearchState() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setSelectedIndex(0); // Reset selection when query changes
  }, []);

  const selectNext = useCallback((maxIndex: number) => {
    setSelectedIndex((prev) => Math.min(prev + 1, maxIndex));
  }, []);

  const selectPrevious = useCallback(() => {
    setSelectedIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  return {
    query,
    isOpen,
    selectedIndex,
    setQuery: updateQuery,
    open,
    close,
    toggle,
    selectNext,
    selectPrevious,
  };
}
