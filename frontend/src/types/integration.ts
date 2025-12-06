/**
 * Integration Types
 */

export type IntegrationType = 'GOOGLE_CONTACTS' | 'MICROSOFT_GRAPH' | 'WHATSAPP_BUSINESS' | 'GMAIL' | 'GOOGLE_CALENDAR';

export type IntegrationStatus = 'ACTIVE' | 'DISCONNECTED' | 'ERROR' | 'PENDING';

// Gmail Integration Types

export interface GmailStatusResponse {
  isConnected: boolean;
  integrationId?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  totalEmailsSynced: number;
  syncEnabled: boolean;
  privacyMode: boolean;
  isActive?: boolean;
}

export interface GmailConfigResponse {
  id: string;
  userId: string;
  gmailEnabled: boolean;
  syncEnabled: boolean;
  privacyMode: boolean;
  excludedEmails: string[];
  excludedDomains: string[];
  lastGmailSync: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateGmailConfigRequest {
  syncEnabled?: boolean;
  privacyMode?: boolean;
  excludedEmails?: string[];
  excludedDomains?: string[];
}

export interface GmailSyncRequest {
  fullSync?: boolean;
  contactId?: string;
}

export interface GmailSyncResult {
  success: boolean;
  provider: 'gmail';
  emailsProcessed: number;
  emailsStored: number;
  contactsMatched: number;
  errors: Array<{
    emailId?: string;
    contactId?: string;
    error: string;
    timestamp: string;
  }>;
  duration?: number;
  syncedAt: string;
  newHistoryId?: string;
}

export interface GmailOAuthInitiateResponse {
  authUrl: string;
  state: string;
}

export interface GmailDisconnectResponse {
  success: boolean;
  tokensRevoked: boolean;
  emailsPreserved: boolean;
  message: string;
}

export interface Integration {
  id: string;
  userId: string;
  type: IntegrationType;
  status: IntegrationStatus;
  displayName: string;
  metadata?: {
    syncToken?: string;
    lastSyncAt?: string;
    email?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationStatusResponse {
  isConnected: boolean;
  integration?: Integration;
  error?: string;
}

export interface OAuthInitiateResponse {
  authUrl: string;
  state: string;
}

export interface OAuthCallbackResponse {
  success: boolean;
  integration: Integration;
  message?: string;
}

export interface PreviewContact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  labels?: string[];
  photoUrl?: string;
  duplicateMatch?: DuplicateMatch;
}

export interface DuplicateMatch {
  type: 'exact' | 'fuzzy' | 'potential';
  score: number;
  existingContactId: string;
  existingContact: {
    id: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  matchedFields: string[];
}

export interface ImportPreviewResponse {
  contacts: PreviewContact[];
  summary: {
    total: number;
    newContacts: number;
    exactDuplicates: number;
    potentialDuplicates: number;
    availableLabels: string[];
  };
  nextPageToken?: string;
}

export interface TagMapping {
  googleLabel: string;
  customTag: string;
}

export interface CategoryMapping {
  outlookCategory: string;
  customTag: string;
}

export interface ImportContactsRequest {
  selectedContactIds?: string[];
  skipDuplicates: boolean;
  updateExisting: boolean;
  tagMapping?: Record<string, string>;
  excludeLabels?: string[];
  preserveOriginalTags?: boolean;
  // Microsoft-specific options
  categoryMapping?: Record<string, string>;
  preserveOriginalCategories?: boolean;
  includeFolders?: string[];
}

export interface ImportContactsResponse {
  success: boolean;
  imported: number;
  skipped: number;
  updated: number;
  errors: number;
  details?: {
    importedIds: string[];
    skippedIds: string[];
    updatedIds: string[];
    errorIds: string[];
  };
}

export interface DisconnectIntegrationResponse {
  success: boolean;
  message?: string;
}

export interface SyncContactsResponse {
  success: boolean;
  added: number;
  updated: number;
  deleted: number;
  syncToken?: string;
}
