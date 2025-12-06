import { contactsService } from '@/lib/api';
import type { TimelineEventType, TimelineQueryParams } from '@/lib/api/services/contacts.service';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

/**
 * Query key factory for timeline
 */
export const timelineKeys = {
  all: ['timeline'] as const,
  contact: (contactId: string) => [...timelineKeys.all, contactId] as const,
  list: (contactId: string, params?: TimelineQueryParams) =>
    [...timelineKeys.contact(contactId), 'list', params] as const,
};

/**
 * Hook to get unified timeline for a contact with filters
 * Aggregates emails, meetings, calls, notes into a single timeline
 */
export function useTimeline(
  contactId: string,
  params?: TimelineQueryParams
) {
  return useQuery({
    queryKey: timelineKeys.list(contactId, params),
    queryFn: () => contactsService.getTimeline(contactId, params),
    enabled: !!contactId,
  });
}

/**
 * Hook to get unified timeline with infinite scroll pagination
 * Loads more events as user scrolls down
 */
export function useInfiniteTimeline(
  contactId: string,
  options?: {
    types?: TimelineEventType[];
    search?: string;
    limit?: number;
  }
) {
  return useInfiniteQuery({
    queryKey: timelineKeys.list(contactId, { ...options, infinite: true } as TimelineQueryParams),
    queryFn: ({ pageParam }) =>
      contactsService.getTimeline(contactId, {
        types: options?.types,
        search: options?.search,
        limit: options?.limit ?? 20,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: !!contactId,
  });
}

