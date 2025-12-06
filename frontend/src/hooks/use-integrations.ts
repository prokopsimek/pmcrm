import { integrationsService } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import type {
    GmailSyncRequest,
    ImportContactsRequest,
    UpdateGmailConfigRequest
} from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Integrations Hooks
 */

export function useIntegrations() {
  return useQuery({
    queryKey: queryKeys.integrations.lists(),
    queryFn: () => integrationsService.getAllIntegrations(),
  });
}

export function useIntegration(id: string) {
  return useQuery({
    queryKey: queryKeys.integrations.detail(id),
    queryFn: () => integrationsService.getIntegration(id),
    enabled: !!id,
  });
}

// Google Contacts specific hooks

export function useGoogleIntegrationStatus() {
  return useQuery({
    queryKey: queryKeys.integrations.google.status(),
    queryFn: () => integrationsService.google.getStatus(),
  });
}

export function useGoogleContactsPreview(pageToken?: string) {
  return useQuery({
    queryKey: queryKeys.integrations.google.preview(pageToken),
    queryFn: () => integrationsService.google.previewContacts(pageToken),
    enabled: false, // Only fetch when explicitly called
  });
}

export function useInitiateGoogleAuth() {
  return useMutation({
    mutationFn: (orgSlug?: string) => {
      // Store orgSlug in localStorage before OAuth redirect
      if (typeof window !== 'undefined' && orgSlug) {
        localStorage.setItem('oauth_redirect_org', orgSlug);
      }
      return integrationsService.google.initiateAuth();
    },
    onSuccess: (data) => {
      // Redirect to Google OAuth
      if (typeof window !== 'undefined') {
        window.location.href = data.authUrl;
      }
    },
  });
}

export function useGoogleOAuthCallback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) =>
      integrationsService.google.handleCallback(code, state),
    onSuccess: () => {
      // Invalidate integrations list and status
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.google.status() });
    },
  });
}

export function useImportGoogleContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ImportContactsRequest) =>
      integrationsService.google.importContacts(request),
    onSuccess: () => {
      // Invalidate contacts list after import
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.google.status() });
    },
  });
}

export function useSyncGoogleContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsService.google.syncContacts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.google.status() });
    },
  });
}

export function useDisconnectGoogleIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsService.google.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.google.status() });
    },
  });
}

// Gmail specific hooks

export function useGmailIntegrationStatus() {
  return useQuery({
    queryKey: queryKeys.integrations.gmail.status(),
    queryFn: () => integrationsService.gmail.getStatus(),
  });
}

export function useGmailConfig() {
  return useQuery({
    queryKey: queryKeys.integrations.gmail.config(),
    queryFn: () => integrationsService.gmail.getConfig(),
  });
}

export function useInitiateGmailAuth() {
  return useMutation({
    mutationFn: (orgSlug?: string) => {
      // Store orgSlug in localStorage before OAuth redirect
      if (typeof window !== 'undefined' && orgSlug) {
        localStorage.setItem('oauth_redirect_org', orgSlug);
      }
      return integrationsService.gmail.initiateAuth(orgSlug);
    },
    onSuccess: (data) => {
      // Redirect to Gmail OAuth
      if (typeof window !== 'undefined') {
        window.location.href = data.authUrl;
      }
    },
  });
}

export function useUpdateGmailConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: UpdateGmailConfigRequest) =>
      integrationsService.gmail.updateConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.gmail.config() });
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.gmail.status() });
    },
  });
}

export function useSyncGmailEmails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request?: GmailSyncRequest) =>
      integrationsService.gmail.syncEmails(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.gmail.status() });
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
    },
  });
}

export function useDisconnectGmailIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsService.gmail.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.gmail.status() });
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.gmail.config() });
    },
  });
}

// Google Calendar specific hooks

export function useGoogleCalendarStatus() {
  return useQuery({
    queryKey: queryKeys.integrations.googleCalendar.status(),
    queryFn: () => integrationsService.googleCalendar.getStatus(),
  });
}

export function useInitiateGoogleCalendarAuth() {
  return useMutation({
    mutationFn: (orgSlug?: string) => {
      // Store orgSlug in localStorage before OAuth redirect
      if (typeof window !== 'undefined' && orgSlug) {
        localStorage.setItem('oauth_redirect_org', orgSlug);
      }
      return integrationsService.googleCalendar.initiateAuth();
    },
    onSuccess: (data) => {
      // Redirect to Google Calendar OAuth
      if (typeof window !== 'undefined') {
        window.location.href = data.authUrl;
      }
    },
  });
}

export function usePreviewCalendarContacts(
  startDate: string,
  endDate?: string,
  enabled = false
) {
  return useQuery({
    queryKey: queryKeys.integrations.googleCalendar.preview(startDate, endDate),
    queryFn: () =>
      integrationsService.googleCalendar.previewContacts({ startDate, endDate }),
    enabled,
  });
}

export function useImportCalendarContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: {
      startDate: string;
      endDate?: string;
      skipDuplicates?: boolean;
      selectedEmails?: string[];
    }) => integrationsService.googleCalendar.importContacts(request),
    onSuccess: () => {
      // Invalidate contacts list after import
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.googleCalendar.status(),
      });
    },
  });
}

export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsService.googleCalendar.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.lists() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.googleCalendar.status(),
      });
    },
  });
}

export function useGoogleCalendarAvailableCalendars() {
  return useQuery({
    queryKey: queryKeys.integrations.googleCalendar.available(),
    queryFn: () => integrationsService.googleCalendar.getAvailableCalendars(),
  });
}

export function useGoogleCalendarConfig() {
  return useQuery({
    queryKey: queryKeys.integrations.googleCalendar.config(),
    queryFn: () => integrationsService.googleCalendar.getConfig(),
  });
}

export function useUpdateGoogleCalendarConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: { selectedCalendarIds: string[]; syncPeriodDays?: number }) =>
      integrationsService.googleCalendar.updateConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.googleCalendar.config(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.googleCalendar.status(),
      });
    },
  });
}

// Microsoft specific hooks (placeholder - not yet implemented on backend)

export function useMicrosoftIntegrationStatus() {
  return useQuery({
    queryKey: ['integrations', 'microsoft', 'status'],
    queryFn: async () => ({ connected: false, email: null, lastSyncAt: null }),
  });
}

export function useMicrosoftContactsPreview(_pageToken?: string) {
  return useQuery({
    queryKey: ['integrations', 'microsoft', 'preview'],
    queryFn: async () => ({
      newContacts: [] as unknown[],
      duplicates: [] as unknown[],
      summary: { total: 0, new: 0, duplicates: 0 },
      tagsPreview: [] as string[],
      sharedFolders: [] as unknown[],
      nextPageToken: null,
    }),
    enabled: false,
  });
}

export function useImportMicrosoftContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_request: ImportContactsRequest): Promise<{
      imported: number;
      updated: number;
      skipped: number;
      failed: number;
    }> => {
      throw new Error('Microsoft contacts import not yet implemented');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
    },
  });
}

export function useInitiateMicrosoftAuth() {
  return useMutation({
    mutationFn: async () => {
      throw new Error('Microsoft auth not yet implemented');
    },
  });
}

export function useDisconnectMicrosoftIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      throw new Error('Microsoft disconnect not yet implemented');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.lists() });
    },
  });
}
