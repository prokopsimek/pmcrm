import type {
    Contact,
    ContactFilters,
    CreateContactInput,
    PaginatedResponse,
    QueryParams,
    UpdateContactInput,
} from '@/types';
import { apiClient } from '../client';

// Backend returns response with nested 'meta' object
interface BackendPaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Contacts API Service
 */
export const contactsService = {
  /**
   * Get all contacts with optional filters and pagination
   * US-061: Extended filters support
   */
  getContacts: async (
    params?: QueryParams & ContactFilters
  ): Promise<PaginatedResponse<Contact>> => {
    // Transform tags array to comma-separated string for API
    const apiParams = params ? {
      ...params,
      tags: params.tags?.join(','),
    } : undefined;
    const response = await apiClient.get<BackendPaginatedResponse<Contact>>('/contacts', apiParams as Record<string, unknown>);
    // Transform backend response format to frontend format
    const backendData = response.data;
    return {
      data: backendData.data,
      total: backendData.meta?.total ?? 0,
      page: backendData.meta?.page ?? 1,
      pageSize: backendData.meta?.limit ?? 20,
      totalPages: backendData.meta?.totalPages ?? 1,
    };
  },

  /**
   * Get a single contact by ID
   */
  getContact: async (id: string): Promise<Contact> => {
    const response = await apiClient.get<Contact>(`/contacts/${id}`);
    return response.data;
  },

  /**
   * Create a new contact
   */
  createContact: async (data: CreateContactInput): Promise<Contact> => {
    // Map frontend 'position' field to backend 'title' field
    const { position, ...rest } = data;
    const backendData = {
      ...rest,
      title: position,
    };
    const response = await apiClient.post<Contact>('/contacts', backendData);
    return response.data;
  },

  /**
   * Update an existing contact
   */
  updateContact: async ({ id, position, ...rest }: UpdateContactInput): Promise<Contact> => {
    // Map frontend 'position' field to backend 'title' field
    const backendData = {
      ...rest,
      ...(position !== undefined && { title: position }),
    };
    const response = await apiClient.patch<Contact>(`/contacts/${id}`, backendData);
    return response.data;
  },

  /**
   * Delete a contact
   */
  deleteContact: async (id: string): Promise<void> => {
    await apiClient.delete(`/contacts/${id}`);
  },

  /**
   * Search contacts
   */
  searchContacts: async (query: string): Promise<Contact[]> => {
    const response = await apiClient.get<Contact[]>('/contacts/search', { q: query });
    return response.data;
  },

  /**
   * Get email timeline for a contact
   */
  getContactEmails: async (
    contactId: string,
    params?: { limit?: number; cursor?: string; sync?: boolean }
  ): Promise<{
    data: ContactEmail[];
    total: number;
    hasMore: boolean;
    nextCursor?: string;
  }> => {
    const response = await apiClient.get<{
      data: ContactEmail[];
      total: number;
      hasMore: boolean;
      nextCursor?: string;
    }>(`/contacts/${contactId}/emails`, params as Record<string, unknown>);
    return response.data;
  },

  /**
   * Get single email with full body content
   */
  getEmailBody: async (contactId: string, emailId: string): Promise<ContactEmail> => {
    const response = await apiClient.get<ContactEmail>(`/contacts/${contactId}/emails/${emailId}`);
    return response.data;
  },

  /**
   * Get AI summary for a contact
   */
  getAISummary: async (
    contactId: string,
    regenerate = false
  ): Promise<ContactAISummary> => {
    const response = await apiClient.get<ContactAISummary>(`/contacts/${contactId}/ai-summary`, { regenerate });
    return response.data;
  },

  /**
   * Regenerate AI summary for a contact
   */
  regenerateAISummary: async (contactId: string): Promise<ContactAISummary> => {
    const response = await apiClient.post<ContactAISummary>(`/contacts/${contactId}/ai-summary`);
    return response.data;
  },

  /**
   * Get AI recommendations for a contact
   */
  getRecommendations: async (
    contactId: string,
    regenerate = false
  ): Promise<ContactRecommendations> => {
    const response = await apiClient.get<ContactRecommendations>(`/contacts/${contactId}/recommendations`, { regenerate });
    return response.data;
  },

  /**
   * Get reminders for a contact
   */
  getContactReminders: async (contactId: string): Promise<ContactReminder[]> => {
    const response = await apiClient.get<ContactReminder[]>(`/contacts/${contactId}/reminders`);
    return response.data;
  },

  /**
   * Get unified timeline for a contact
   * Aggregates emails, meetings, calls, notes into a single timeline
   */
  getTimeline: async (
    contactId: string,
    params?: TimelineQueryParams
  ): Promise<TimelineResponse> => {
    const apiParams = params ? {
      ...params,
      types: params.types?.join(','),
    } : undefined;
    const response = await apiClient.get<TimelineResponse>(
      `/contacts/${contactId}/timeline`,
      apiParams as Record<string, unknown>
    );
    return response.data;
  },
};

// Types for new endpoints
export interface ContactEmail {
  id: string;
  threadId: string;
  subject: string | null;
  snippet: string | null;
  aiSummary: string | null;
  body: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  occurredAt: string;
  externalId: string;
}

export interface ContactAISummary {
  id: string;
  summaryType: string;
  content: string;
  recommendations?: AIRecommendation[];
  generatedAt: string;
  emailsIncluded: number;
  lastEmailDate: string | null;
  isCached: boolean;
}

export interface AIRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'follow_up' | 'meeting' | 'email' | 'call' | 'other';
}

export interface ContactRecommendations {
  id: string;
  summaryType: string;
  content: string;
  recommendations: AIRecommendation[];
  generatedAt: string;
  emailsIncluded: number;
  lastEmailDate: string | null;
  isCached: boolean;
}

export interface ContactReminder {
  id: string;
  title: string;
  message: string | null;
  scheduledFor: string;
  dueAt: string | null;
  frequencyDays: number | null;
  priority: number;
  status: 'PENDING' | 'SENT' | 'DISMISSED' | 'SNOOZED' | 'COMPLETED';
  snoozedUntil: string | null;
  completedAt: string | null;
  createdAt: string;
}

// Timeline types
export type TimelineEventType =
  | 'email'
  | 'meeting'
  | 'call'
  | 'note'
  | 'linkedin_message'
  | 'linkedin_connection'
  | 'whatsapp'
  | 'other';

export interface TimelineQueryParams {
  types?: TimelineEventType[];
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  occurredAt: string;
  title: string;
  snippet?: string;
  direction?: 'inbound' | 'outbound';
  participationType?: 'sender' | 'recipient' | 'cc';
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineResponse {
  data: TimelineEvent[];
  total: number;
  nextCursor?: string;
  hasMore: boolean;
}
