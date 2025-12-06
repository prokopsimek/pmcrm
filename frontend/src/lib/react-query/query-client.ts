import { QueryClient, DefaultOptions } from '@tanstack/react-query';

/**
 * Default options for React Query
 */
const queryConfig: DefaultOptions = {
  queries: {
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  },
  mutations: {
    retry: 0,
  },
};

/**
 * Query client instance
 */
export const queryClient = new QueryClient({
  defaultOptions: queryConfig,
});
