/**
 * Query Keys Factory
 * Centralized query keys for React Query
 */

export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },
  contacts: {
    all: ['contacts'] as const,
    lists: () => [...queryKeys.contacts.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      filters ? [...queryKeys.contacts.lists(), filters] as const : queryKeys.contacts.lists(),
    details: () => [...queryKeys.contacts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.contacts.details(), id] as const,
    search: (query: string) => [...queryKeys.contacts.all, 'search', query] as const,
    emails: (id: string, options?: Record<string, unknown>) =>
      options
        ? [...queryKeys.contacts.all, id, 'emails', options] as const
        : [...queryKeys.contacts.all, id, 'emails'] as const,
  },
  interactions: {
    all: ['interactions'] as const,
    lists: () => [...queryKeys.interactions.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      filters ? [...queryKeys.interactions.lists(), filters] as const : queryKeys.interactions.lists(),
    details: () => [...queryKeys.interactions.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.interactions.details(), id] as const,
    byContact: (contactId: string) =>
      [...queryKeys.interactions.all, 'contact', contactId] as const,
  },
  companies: {
    all: ['companies'] as const,
    lists: () => [...queryKeys.companies.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      filters ? [...queryKeys.companies.lists(), filters] as const : queryKeys.companies.lists(),
    details: () => [...queryKeys.companies.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.companies.details(), id] as const,
  },
  search: {
    all: ['search'] as const,
    contacts: (query: string, options?: Record<string, unknown>) =>
      options
        ? [...queryKeys.search.all, 'contacts', query, options] as const
        : [...queryKeys.search.all, 'contacts', query] as const,
    recent: () => [...queryKeys.search.all, 'recent'] as const,
  },
  integrations: {
    all: ['integrations'] as const,
    lists: () => [...queryKeys.integrations.all, 'list'] as const,
    details: () => [...queryKeys.integrations.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.integrations.details(), id] as const,
    google: {
      all: ['integrations', 'google'] as const,
      status: () => [...queryKeys.integrations.google.all, 'status'] as const,
      preview: (pageToken?: string) =>
        pageToken
          ? [...queryKeys.integrations.google.all, 'preview', pageToken] as const
          : [...queryKeys.integrations.google.all, 'preview'] as const,
    },
    gmail: {
      all: ['integrations', 'gmail'] as const,
      status: () => [...queryKeys.integrations.gmail.all, 'status'] as const,
      config: () => [...queryKeys.integrations.gmail.all, 'config'] as const,
    },
    googleCalendar: {
      all: ['integrations', 'googleCalendar'] as const,
      status: () => [...queryKeys.integrations.googleCalendar.all, 'status'] as const,
      preview: (startDate: string, endDate?: string) =>
        endDate
          ? ([...queryKeys.integrations.googleCalendar.all, 'preview', startDate, endDate] as const)
          : ([...queryKeys.integrations.googleCalendar.all, 'preview', startDate] as const),
      available: () => [...queryKeys.integrations.googleCalendar.all, 'available'] as const,
      config: () => [...queryKeys.integrations.googleCalendar.all, 'config'] as const,
    },
  },
  onboarding: {
    all: ['onboarding'] as const,
    status: () => [...queryKeys.onboarding.all, 'status'] as const,
  },
  icebreaker: {
    all: ['icebreaker'] as const,
    history: () => [...queryKeys.icebreaker.all, 'history'] as const,
    detail: (id: string) => [...queryKeys.icebreaker.all, 'detail', id] as const,
    byContact: (contactId: string) => [...queryKeys.icebreaker.all, 'contact', contactId] as const,
  },
} as const;
