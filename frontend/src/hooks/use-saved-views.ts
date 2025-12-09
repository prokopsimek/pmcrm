import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { savedViewsService } from '@/lib/api';
import type { SavedView, CreateSavedViewInput, UpdateSavedViewInput } from '@/types/saved-view';

/**
 * Query keys for saved views
 */
const savedViewsKeys = {
  all: ['saved-views'] as const,
  list: () => [...savedViewsKeys.all, 'list'] as const,
  default: () => [...savedViewsKeys.all, 'default'] as const,
  detail: (id: string) => [...savedViewsKeys.all, id] as const,
};

/**
 * Hook to fetch all saved views
 * US-061: Advanced Filtering
 */
export function useSavedViews() {
  return useQuery({
    queryKey: savedViewsKeys.list(),
    queryFn: savedViewsService.getSavedViews,
  });
}

/**
 * Hook to fetch the default saved view
 */
export function useDefaultView() {
  return useQuery({
    queryKey: savedViewsKeys.default(),
    queryFn: savedViewsService.getDefaultView,
  });
}

/**
 * Hook to create a new saved view
 */
export function useCreateSavedView() {
  const queryClient = useQueryClient();

  return useMutation<SavedView, Error, CreateSavedViewInput>({
    mutationFn: savedViewsService.createSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewsKeys.list() });
      queryClient.invalidateQueries({ queryKey: savedViewsKeys.default() });
    },
  });
}

/**
 * Hook to update an existing saved view
 */
export function useUpdateSavedView() {
  const queryClient = useQueryClient();

  return useMutation<SavedView, Error, { id: string; data: UpdateSavedViewInput }>({
    mutationFn: ({ id, data }) => savedViewsService.updateSavedView(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: savedViewsKeys.list() });
      queryClient.invalidateQueries({ queryKey: savedViewsKeys.default() });
      queryClient.invalidateQueries({ queryKey: savedViewsKeys.detail(data.id) });
    },
  });
}

/**
 * Hook to delete a saved view
 */
export function useDeleteSavedView() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: savedViewsService.deleteSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewsKeys.list() });
      queryClient.invalidateQueries({ queryKey: savedViewsKeys.default() });
    },
  });
}

/**
 * Hook to set a saved view as default
 */
export function useSetDefaultView() {
  const queryClient = useQueryClient();

  return useMutation<SavedView, Error, string>({
    mutationFn: savedViewsService.setDefaultView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewsKeys.list() });
      queryClient.invalidateQueries({ queryKey: savedViewsKeys.default() });
    },
  });
}












