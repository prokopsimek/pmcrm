import { contactsService } from '@/lib/api';
import { getApiUrl } from '@/lib/api/config';
import type { ContactEmail } from '@/lib/api/services/contacts.service';
import { queryKeys } from '@/lib/react-query';
import type {
    ContactFilters,
    CreateContactInput,
    QueryParams,
    UpdateContactInput
} from '@/types';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

/**
 * Contacts Hooks
 */

export function useContacts(params?: QueryParams & ContactFilters) {
  return useQuery({
    queryKey: queryKeys.contacts.list(params as Record<string, unknown>),
    queryFn: () => contactsService.getContacts(params),
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: queryKeys.contacts.detail(id),
    queryFn: () => contactsService.getContact(id),
    enabled: !!id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateContactInput) => contactsService.createContact(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateContactInput) => contactsService.updateContact(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
      queryClient.setQueryData(queryKeys.contacts.detail(data.id), data);
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => contactsService.deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
    },
  });
}

export function useSearchContacts(query: string) {
  return useQuery({
    queryKey: queryKeys.contacts.search(query),
    queryFn: () => contactsService.searchContacts(query),
    enabled: query.length > 0,
  });
}

/**
 * Hook to get email timeline for a contact (non-streaming)
 * Fetches emails from the database with optional Gmail sync
 */
export function useContactEmails(
  contactId: string,
  options?: { limit?: number; cursor?: string; sync?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.contacts.emails(contactId, options as Record<string, unknown>),
    queryFn: () => contactsService.getContactEmails(contactId, {
      limit: options?.limit ?? 50,
      cursor: options?.cursor,
      sync: options?.sync,
    }),
    enabled: !!contactId,
  });
}

/**
 * Hook to get email timeline with infinite scroll pagination
 * Loads more emails as user scrolls down
 */
export function useInfiniteContactEmails(
  contactId: string,
  options?: { limit?: number; sync?: boolean }
) {
  return useInfiniteQuery({
    queryKey: queryKeys.contacts.emails(contactId, { infinite: true, ...options } as Record<string, unknown>),
    queryFn: ({ pageParam }) => contactsService.getContactEmails(contactId, {
      limit: options?.limit ?? 20,
      cursor: pageParam,
      sync: options?.sync,
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: !!contactId,
  });
}

/**
 * Hook to stream emails with progressive AI summary generation (SSE)
 * Uses fetch with streaming to support cookie-based authentication
 */
export function useStreamingEmails(contactId: string, enabled = true) {
  const [emails, setEmails] = useState<ContactEmail[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const startStreaming = useCallback(async () => {
    if (!contactId || !enabled) return;

    setIsLoading(true);
    setIsComplete(false);
    setError(null);
    setEmails([]);

    try {
      const response = await fetch(
        getApiUrl(`contacts/${contactId}/emails/stream?regenerate=true`),
        {
          method: 'GET',
          credentials: 'include', // Send cookies for auth
          headers: {
            'Accept': 'text/event-stream',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        console.log('[SSE] Chunk received:', { done, valueLength: value?.length });
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        console.log('[SSE] Buffer length:', buffer.length, 'Buffer preview:', buffer.slice(0, 300));

        // Process complete SSE events (separated by \n\n)
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer
        console.log('[SSE] Events found:', events.length, 'Remaining buffer:', buffer.length);

        for (const event of events) {
          console.log('[SSE] Processing event:', event.slice(0, 150));
          // Find data line(s) within event (handles id:, retry:, data: lines)
          const eventLines = event.split('\n');
          let dataContent = '';

          for (const eventLine of eventLines) {
            if (eventLine.startsWith('data: ')) {
              dataContent += eventLine.slice(6);
            } else if (eventLine.startsWith('data:')) {
              dataContent += eventLine.slice(5);
            }
          }

          console.log('[SSE] Data content extracted:', dataContent.slice(0, 100));

          if (dataContent) {
            try {
              const data = JSON.parse(dataContent);
              console.log('[SSE] Parsed data:', data.type, data.type === 'email' ? `index=${data.index}` : '');

              if (data.type === 'init') {
                setTotal(data.total);
              } else if (data.type === 'email') {
                setEmails((prev) => {
                  const newEmails = [...prev];
                  newEmails[data.index] = data.email;
                  return newEmails;
                });
              } else if (data.type === 'complete') {
                setIsComplete(true);
                setIsLoading(false);
              }
            } catch (parseErr) {
              console.error('[SSE] Error parsing SSE data:', parseErr, dataContent);
            }
          } else {
            console.log('[SSE] No data content found in event');
          }
        }
      }

      setIsComplete(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Streaming error:', err);
      setError(err instanceof Error ? err : new Error('Failed to stream emails'));
      setIsLoading(false);
    }
  }, [contactId, enabled]);

  // Start streaming when contactId changes
  useEffect(() => {
    startStreaming();
  }, [startStreaming]);

  return {
    emails: emails.filter(Boolean),
    total,
    isLoading,
    isComplete,
    error,
    refetch: startStreaming,
  };
}

/**
 * Hook to get single email with full body (lazy loaded)
 */
export function useEmailBody(contactId: string, emailId: string | null) {
  return useQuery({
    queryKey: ['contacts', contactId, 'emails', emailId, 'body'],
    queryFn: () => contactsService.getEmailBody(contactId, emailId!),
    enabled: !!contactId && !!emailId,
  });
}

/**
 * Hook to get AI summary for a contact
 */
export function useContactAISummary(contactId: string) {
  return useQuery({
    queryKey: ['contacts', contactId, 'ai-summary'],
    queryFn: () => contactsService.getAISummary(contactId),
    enabled: !!contactId,
  });
}

/**
 * Hook to regenerate AI summary
 */
export function useRegenerateAISummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contactId: string) => contactsService.regenerateAISummary(contactId),
    onSuccess: (data, contactId) => {
      queryClient.setQueryData(['contacts', contactId, 'ai-summary'], data);
      // Invalidate contact query to refresh relationship score (importance)
      queryClient.invalidateQueries({ queryKey: ['contacts', contactId] });
    },
  });
}

/**
 * Hook to get AI recommendations for a contact
 */
export function useContactRecommendations(contactId: string) {
  return useQuery({
    queryKey: ['contacts', contactId, 'recommendations'],
    queryFn: () => contactsService.getRecommendations(contactId),
    enabled: !!contactId,
  });
}

/**
 * Hook to get reminders for a contact
 */
export function useContactReminders(contactId: string) {
  return useQuery({
    queryKey: ['contacts', contactId, 'reminders'],
    queryFn: () => contactsService.getContactReminders(contactId),
    enabled: !!contactId,
  });
}
