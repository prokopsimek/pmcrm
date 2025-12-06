import type {
    DisconnectIntegrationResponse,
    GmailConfigResponse,
    GmailDisconnectResponse,
    GmailOAuthInitiateResponse,
    GmailStatusResponse,
    GmailSyncRequest,
    GmailSyncResult,
    ImportContactsRequest,
    ImportContactsResponse,
    ImportPreviewResponse,
    Integration,
    IntegrationStatusResponse,
    OAuthCallbackResponse,
    OAuthInitiateResponse,
    SyncContactsResponse,
    UpdateGmailConfigRequest,
} from '@/types';
import { apiClient } from '../client';

/**
 * Integrations API Service
 */

export const integrationsService = {
  // Google Contacts Integration
  google: {
    /**
     * Get Google OAuth authorization URL
     */
    async initiateAuth(): Promise<OAuthInitiateResponse> {
      const response = await apiClient.get<OAuthInitiateResponse>(
        '/integrations/google/auth'
      );
      return response.data;
    },

    /**
     * Handle OAuth callback
     */
    async handleCallback(code: string, state: string): Promise<OAuthCallbackResponse> {
      const response = await apiClient.get<OAuthCallbackResponse>(
        '/integrations/google/callback',
        { code, state }
      );
      return response.data;
    },

    /**
     * Get integration status
     */
    async getStatus(): Promise<IntegrationStatusResponse> {
      const response = await apiClient.get<IntegrationStatusResponse>(
        '/integrations/google/status'
      );
      return response.data;
    },

    /**
     * Preview contacts before import
     */
    async previewContacts(pageToken?: string): Promise<ImportPreviewResponse> {
      // Backend returns different structure than frontend expects
      interface BackendPreviewResponse {
        totalFetched: number;
        newContacts: Array<{
          externalId: string;
          firstName: string;
          lastName?: string;
          email?: string;
          phone?: string;
          company?: string;
          position?: string;
          tags: string[];
        }>;
        duplicates: Array<{
          importedContact: {
            externalId: string;
            firstName: string;
            lastName?: string;
            email?: string;
            phone?: string;
            company?: string;
          };
          existingContact: {
            id: string;
            firstName: string;
            lastName?: string;
            email?: string;
            phone?: string;
          };
          similarity: number;
          matchType: 'EXACT' | 'POTENTIAL' | 'FUZZY';
          matchedFields: string[];
        }>;
        summary: {
          total: number;
          new: number;
          exactDuplicates: number;
          potentialDuplicates: number;
        };
        tagsPreview: string[];
      }

      const response = await apiClient.get<BackendPreviewResponse>(
        '/integrations/google/contacts/preview',
        pageToken ? { pageToken } : undefined
      );

      const backendData = response.data;

      // Map backend response to frontend expected format
      const contacts = [
        // Map new contacts
        ...backendData.newContacts.map(c => ({
          id: c.externalId,
          firstName: c.firstName,
          lastName: c.lastName || '',
          email: c.email,
          phone: c.phone,
          company: c.company,
          position: c.position,
          labels: c.tags,
        })),
        // Map duplicate contacts (with duplicate info)
        ...backendData.duplicates.map(d => ({
          id: d.importedContact.externalId,
          firstName: d.importedContact.firstName,
          lastName: d.importedContact.lastName || '',
          email: d.importedContact.email,
          phone: d.importedContact.phone,
          company: d.importedContact.company,
          duplicateMatch: {
            type: d.matchType.toLowerCase() as 'exact' | 'fuzzy' | 'potential',
            score: d.similarity,
            existingContactId: d.existingContact.id,
            existingContact: d.existingContact,
            matchedFields: d.matchedFields,
          },
        })),
      ];

      return {
        contacts,
        summary: {
          total: backendData.summary.total,
          newContacts: backendData.summary.new,
          exactDuplicates: backendData.summary.exactDuplicates,
          potentialDuplicates: backendData.summary.potentialDuplicates,
          availableLabels: backendData.tagsPreview,
        },
      };
    },

    /**
     * Import selected contacts
     */
    async importContacts(request: ImportContactsRequest): Promise<ImportContactsResponse> {
      const response = await apiClient.post<ImportContactsResponse>(
        '/integrations/google/contacts/import',
        request
      );
      return response.data;
    },

    /**
     * Sync incremental changes
     */
    async syncContacts(): Promise<SyncContactsResponse> {
      const response = await apiClient.post<SyncContactsResponse>(
        '/integrations/google/contacts/sync'
      );
      return response.data;
    },

    /**
     * Disconnect integration
     */
    async disconnect(): Promise<DisconnectIntegrationResponse> {
      const response = await apiClient.delete<DisconnectIntegrationResponse>(
        '/integrations/google/disconnect'
      );
      return response.data;
    },
  },

  // Gmail Integration
  gmail: {
    /**
     * Get Gmail OAuth authorization URL
     */
    async initiateAuth(orgSlug?: string): Promise<GmailOAuthInitiateResponse> {
      const params = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const response = await apiClient.get<GmailOAuthInitiateResponse>(
        `/integrations/gmail/auth${params}`
      );
      return response.data;
    },

    /**
     * Get Gmail integration status
     */
    async getStatus(): Promise<GmailStatusResponse> {
      const response = await apiClient.get<GmailStatusResponse>(
        '/integrations/gmail/status'
      );
      return response.data;
    },

    /**
     * Get Gmail sync configuration
     */
    async getConfig(): Promise<GmailConfigResponse | null> {
      const response = await apiClient.get<GmailConfigResponse | null>(
        '/integrations/gmail/config'
      );
      return response.data;
    },

    /**
     * Update Gmail sync configuration
     */
    async updateConfig(config: UpdateGmailConfigRequest): Promise<GmailConfigResponse> {
      const response = await apiClient.put<GmailConfigResponse>(
        '/integrations/gmail/config',
        config
      );
      return response.data;
    },

    /**
     * Trigger Gmail email sync
     */
    async syncEmails(request?: GmailSyncRequest): Promise<GmailSyncResult> {
      const response = await apiClient.post<GmailSyncResult>(
        '/integrations/gmail/sync',
        request || {}
      );
      return response.data;
    },

    /**
     * Disconnect Gmail integration
     */
    async disconnect(): Promise<GmailDisconnectResponse> {
      const response = await apiClient.delete<GmailDisconnectResponse>(
        '/integrations/gmail/disconnect'
      );
      return response.data;
    },
  },

  // Google Calendar Integration
  googleCalendar: {
    /**
     * Initiate Google Calendar OAuth flow
     */
    async initiateAuth(): Promise<{ authUrl: string; state: string; scopes: string[] }> {
      const response = await apiClient.post<{ authUrl: string; state: string; scopes: string[] }>(
        '/integrations/google-calendar/connect'
      );
      return response.data;
    },

    /**
     * Get Google Calendar integration status
     */
    async getStatus(): Promise<{
      isConnected: boolean;
      provider?: string;
      totalMeetings: number;
      lastSyncAt?: string;
      syncEnabled: boolean;
      isConfigured?: boolean;
      selectedCalendarIds?: string[];
    }> {
      const response = await apiClient.get<{
        isConnected: boolean;
        provider?: string;
        totalMeetings: number;
        lastSyncAt?: string;
        syncEnabled: boolean;
        isConfigured?: boolean;
        selectedCalendarIds?: string[];
      }>('/calendar/status');
      return response.data;
    },

    /**
     * Preview contacts from calendar events
     */
    async previewContacts(query: {
      startDate: string;
      endDate?: string;
    }): Promise<{
      summary: {
        totalEvents: number;
        totalAttendees: number;
        newContacts: number;
        exactDuplicates: number;
        periodStart: string;
        periodEnd: string;
      };
      newContacts: Array<{
        email: string;
        displayName?: string;
        firstName: string;
        lastName?: string;
        meetingCount: number;
        lastMeetingDate: string;
        firstMeetingDate: string;
        company?: string;
      }>;
      duplicates: Array<{
        attendee: {
          email: string;
          displayName?: string;
          firstName: string;
          lastName?: string;
          meetingCount: number;
          lastMeetingDate: string;
          firstMeetingDate: string;
          company?: string;
        };
        existingContact: {
          id: string;
          firstName: string;
          lastName?: string;
          email?: string;
          company?: string;
          source: string;
        };
        matchType: 'EXACT' | 'POTENTIAL';
      }>;
    }> {
      const response = await apiClient.post<{
        summary: {
          totalEvents: number;
          totalAttendees: number;
          newContacts: number;
          exactDuplicates: number;
          periodStart: string;
          periodEnd: string;
        };
        newContacts: Array<{
          email: string;
          displayName?: string;
          firstName: string;
          lastName?: string;
          meetingCount: number;
          lastMeetingDate: string;
          firstMeetingDate: string;
          company?: string;
        }>;
        duplicates: Array<{
          attendee: {
            email: string;
            displayName?: string;
            firstName: string;
            lastName?: string;
            meetingCount: number;
            lastMeetingDate: string;
            firstMeetingDate: string;
            company?: string;
          };
          existingContact: {
            id: string;
            firstName: string;
            lastName?: string;
            email?: string;
            company?: string;
            source: string;
          };
          matchType: 'EXACT' | 'POTENTIAL';
        }>;
      }>('/calendar/contacts/preview', query);
      return response.data;
    },

    /**
     * Import contacts from calendar events
     */
    async importContacts(request: {
      startDate: string;
      endDate?: string;
      skipDuplicates?: boolean;
      selectedEmails?: string[];
    }): Promise<{
      success: boolean;
      imported: number;
      skipped: number;
      failed: number;
      errors?: string[];
      duration: number;
      timestamp: string;
    }> {
      const response = await apiClient.post<{
        success: boolean;
        imported: number;
        skipped: number;
        failed: number;
        errors?: string[];
        duration: number;
        timestamp: string;
      }>('/calendar/contacts/import', request);
      return response.data;
    },

    /**
     * Get list of available calendars
     */
    async getAvailableCalendars(): Promise<{
      calendars: Array<{
        id: string;
        name: string;
        description?: string;
        isPrimary: boolean;
        color?: string;
      }>;
    }> {
      const response = await apiClient.get<{
        calendars: Array<{
          id: string;
          name: string;
          description?: string;
          isPrimary: boolean;
          color?: string;
        }>;
      }>('/calendar/available');
      return response.data;
    },

    /**
     * Get calendar configuration
     */
    async getConfig(): Promise<{
      selectedCalendarIds: string[];
      syncEnabled: boolean;
      isConfigured: boolean;
      syncPeriodDays: number;
      lastSyncAt?: string;
    }> {
      const response = await apiClient.get<{
        selectedCalendarIds: string[];
        syncEnabled: boolean;
        isConfigured: boolean;
        syncPeriodDays: number;
        lastSyncAt?: string;
      }>('/calendar/config');
      return response.data;
    },

    /**
     * Update calendar selection and sync period
     */
    async updateConfig(config: {
      selectedCalendarIds: string[];
      syncPeriodDays?: number;
    }): Promise<{
      selectedCalendarIds: string[];
      syncEnabled: boolean;
      isConfigured: boolean;
      syncPeriodDays: number;
      lastSyncAt?: string;
    }> {
      const response = await apiClient.put<{
        selectedCalendarIds: string[];
        syncEnabled: boolean;
        isConfigured: boolean;
        syncPeriodDays: number;
        lastSyncAt?: string;
      }>('/calendar/config', config);
      return response.data;
    },

    /**
     * Disconnect Google Calendar integration
     */
    async disconnect(): Promise<{
      success: boolean;
      tokensRevoked: boolean;
      warning?: string;
    }> {
      const response = await apiClient.delete<{
        success: boolean;
        tokensRevoked: boolean;
        warning?: string;
      }>('/integrations/calendar/disconnect');
      return response.data;
    },
  },

  /**
   * Get all integrations for current user
   */
  async getAllIntegrations(): Promise<Integration[]> {
    const response = await apiClient.get<Integration[]>('/integrations');
    return response.data;
  },

  /**
   * Get integration by ID
   */
  async getIntegration(id: string): Promise<Integration> {
    const response = await apiClient.get<Integration>(`/integrations/${id}`);
    return response.data;
  },
};
