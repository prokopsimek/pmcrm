import { IsBoolean, IsOptional, IsArray, IsString, IsObject, IsEnum } from 'class-validator';

/**
 * DTO for importing contacts from Microsoft 365
 */
export class ImportContactsDto {
  @IsBoolean()
  skipDuplicates: boolean;

  @IsBoolean()
  updateExisting: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedContactIds?: string[]; // Array of Microsoft contact IDs

  @IsOptional()
  @IsObject()
  categoryMapping?: Record<string, string>; // Map Outlook categories to custom tags

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeCategories?: string[]; // Categories to exclude from import

  @IsOptional()
  @IsBoolean()
  preserveOriginalCategories?: boolean; // Keep original Outlook categories in addition to mapped tags

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeFolders?: string[]; // Specific folders to import from (including shared)
}

/**
 * Response DTO for import operation
 */
export class ImportContactsResponseDto {
  success: boolean;
  imported: number;
  skipped: number;
  updated: number;
  failed: number;
  errors: ImportErrorDto[];
  duration?: number; // milliseconds
  timestamp: Date;
}

/**
 * Import error details
 */
export class ImportErrorDto {
  contactId: string;
  error: string;
  field?: string;
}

/**
 * Conflict resolution strategy enum
 */
export enum ConflictStrategy {
  LAST_WRITE_WINS = 'LAST_WRITE_WINS',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  CRM_PRIORITY = 'CRM_PRIORITY',
  OUTLOOK_PRIORITY = 'OUTLOOK_PRIORITY',
}

/**
 * Sync direction enum
 */
export enum SyncDirection {
  BIDIRECTIONAL = 'BIDIRECTIONAL',
  CRM_TO_OUTLOOK = 'CRM_TO_OUTLOOK',
  OUTLOOK_TO_CRM = 'OUTLOOK_TO_CRM',
}

/**
 * DTO for sync configuration
 */
export class SyncConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsEnum(ConflictStrategy)
  strategy: ConflictStrategy;

  @IsEnum(SyncDirection)
  syncDirection: SyncDirection;

  @IsOptional()
  @IsEnum(ConflictStrategy)
  conflictResolution?: ConflictStrategy;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedFields?: string[]; // Fields to exclude from sync
}

/**
 * DTO for sync operation response
 */
export class SyncContactsResponseDto {
  success: boolean;
  added: number;
  updated: number;
  deleted: number;
  syncedAt: Date;
  deltaLink?: string;
  duration?: number;
  hasConflicts?: boolean;
  conflictsResolved?: number;
}

/**
 * DTO for bidirectional sync response
 */
export class BidirectionalSyncResponseDto {
  success: boolean;
  direction: 'CRM_TO_OUTLOOK' | 'OUTLOOK_TO_CRM' | 'NO_CHANGE';
  contactId: string;
  externalId?: string;
  updatedAt: Date;
  hasConflicts?: boolean;
  conflicts?: ConflictDto[];
  conflictsResolved?: number;
  requiresManualReview?: boolean;
  action?: 'CREATED_IN_OUTLOOK' | 'UPDATED' | 'NO_CHANGE';
}

/**
 * Conflict information DTO
 */
export class ConflictDto {
  field: string;
  crmValue: any;
  outlookValue: any;
  conflictType?: string;
  resolvedValue?: any;
  appliedStrategy?: ConflictStrategy;
}

/**
 * DTO for OAuth initiation response
 */
export class OAuthInitiateResponseDto {
  authUrl: string;
  state: string;
}

/**
 * DTO for OAuth callback response
 */
export class OAuthCallbackResponseDto {
  success: boolean;
  integrationId: string;
  message: string;
}

/**
 * DTO for disconnect integration response
 */
export class DisconnectIntegrationResponseDto {
  success: boolean;
  linksDeleted: number;
  tokensRevoked: boolean;
  contactsPreserved?: boolean;
  message?: string;
  warning?: string;
}

/**
 * DTO for integration status response
 */
export class IntegrationStatusResponseDto {
  isConnected: boolean;
  integrationId?: string;
  connectedAt?: Date;
  lastSyncAt?: Date;
  totalSyncedContacts: number;
  isActive?: boolean;
  deactivatedAt?: Date;
  reason?: string;
  bidirectionalEnabled?: boolean;
  syncConfig?: SyncConfigDto;
}

/**
 * DTO for shared address books/folders
 */
export class SharedFoldersResponseDto {
  folders: ContactFolderDto[];
  totalCount: number;
}

/**
 * Contact folder DTO
 */
export class ContactFolderDto {
  id: string;
  name: string;
  parentFolderId?: string;
  contactCount?: number;
  isShared?: boolean;
}

/**
 * DTO for conflict resolution request
 */
export class ConflictResolutionDto {
  @IsArray()
  conflicts: ConflictDto[];

  @IsEnum(ConflictStrategy)
  strategy: ConflictStrategy;
}

/**
 * DTO for conflict resolution response
 */
export class ConflictResolutionResponseDto {
  resolved: ResolvedConflictDto[];
  success: boolean;
}

/**
 * Resolved conflict DTO
 */
export class ResolvedConflictDto {
  contactId: string;
  field: string;
  resolvedValue: any;
  strategy: ConflictStrategy;
}
