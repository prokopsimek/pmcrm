import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { icebreakerService } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import type {
  GenerateIcebreakerInput,
  RegenerateIcebreakerInput,
  IcebreakerFeedback,
  IcebreakerResponse,
  IcebreakerHistoryItem,
} from '@/lib/api/services/icebreaker.service';

/**
 * Icebreaker Hooks
 * US-051: AI icebreaker message generation
 */

/**
 * Hook to get icebreaker generation history
 */
export function useIcebreakerHistory() {
  return useQuery({
    queryKey: queryKeys.icebreaker.history(),
    queryFn: () => icebreakerService.getHistory(),
  });
}

/**
 * Hook to generate a new icebreaker message
 */
export function useGenerateIcebreaker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GenerateIcebreakerInput) => icebreakerService.generate(input),
    onSuccess: (data) => {
      // Invalidate history to include new generation
      queryClient.invalidateQueries({ queryKey: queryKeys.icebreaker.history() });
      // Cache the generated icebreaker by ID
      queryClient.setQueryData(queryKeys.icebreaker.detail(data.id), data);
    },
  });
}

/**
 * Hook to regenerate an icebreaker with different parameters
 */
export function useRegenerateIcebreaker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input?: RegenerateIcebreakerInput;
    }) => icebreakerService.regenerate(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.icebreaker.history() });
      queryClient.setQueryData(queryKeys.icebreaker.detail(data.id), data);
    },
  });
}

/**
 * Hook to edit an icebreaker message
 */
export function useEditIcebreaker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, editedContent }: { id: string; editedContent: string }) =>
      icebreakerService.edit(id, editedContent),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.icebreaker.detail(variables.id),
      });
    },
  });
}

/**
 * Hook to select a specific variation
 */
export function useSelectVariation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      variationIndex,
    }: {
      id: string;
      variationIndex: number;
    }) => icebreakerService.selectVariation(id, variationIndex),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.icebreaker.detail(variables.id),
      });
    },
  });
}

/**
 * Hook to submit feedback on an icebreaker
 */
export function useSubmitIcebreakerFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      feedback,
    }: {
      id: string;
      feedback: IcebreakerFeedback;
    }) => icebreakerService.submitFeedback(id, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.icebreaker.history() });
    },
  });
}

// Re-export types for convenience
export type { GenerateIcebreakerInput, IcebreakerResponse, IcebreakerHistoryItem };
export type { IcebreakerChannel, IcebreakerTone, IcebreakerFeedback, MessageVariation } from '@/lib/api/services/icebreaker.service';












