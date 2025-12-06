import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/react-query';

interface OnboardingState {
  currentStep: string;
  completedSteps: string[];
  isCompleted: boolean;
  completedAt?: string;
  steps?: string[];
  progress?: number;
}

interface CompleteStepData {
  step: string;
}

interface CreateWorkspaceData {
  name: string;
  logo?: string;
}

/**
 * Onboarding management hook
 * Handles onboarding state and step completion
 */
export function useOnboarding() {
  const queryClient = useQueryClient();

  // Get onboarding status
  const { data: onboardingStatus, isLoading } = useQuery<OnboardingState>({
    queryKey: queryKeys.onboarding.status(),
    queryFn: async () => {
      const response = await apiClient.get<OnboardingState>('/users/onboarding/status');
      return response.data;
    },
  });

  // Complete onboarding step
  const completeStepMutation = useMutation({
    mutationFn: async (data: CompleteStepData) => {
      const response = await apiClient.post<OnboardingState>(
        '/users/onboarding/complete-step',
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.status() });
    },
  });

  // Create workspace
  const createWorkspaceMutation = useMutation({
    mutationFn: async (data: CreateWorkspaceData) => {
      const response = await apiClient.post('/users/workspace', data);
      return response.data;
    },
  });

  return {
    onboardingStatus,
    isLoading,
    completeStep: (step: string) => completeStepMutation.mutateAsync({ step }),
    createWorkspace: (data: CreateWorkspaceData) => createWorkspaceMutation.mutateAsync(data),
    isCompletingStep: completeStepMutation.isPending,
    isCreatingWorkspace: createWorkspaceMutation.isPending,
  };
}
