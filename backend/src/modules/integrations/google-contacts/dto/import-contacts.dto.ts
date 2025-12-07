import {
    IsArray,
    IsBoolean,
    IsObject,
    IsOptional,
    IsString
} from 'class-validator';

/**
 * DTO for importing contacts from Google
 */
export class ImportContactsDto {
  @IsBoolean()
  skipDuplicates: boolean;

  @IsBoolean()
  updateExisting: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedContactIds?: string[]; // Array of Google people resource names

  @IsOptional()
  @IsObject()
  tagMapping?: Record<string, string>; // Map Google labels to custom tags

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeLabels?: string[]; // Labels to exclude from import

  @IsOptional()
  @IsBoolean()
  preserveOriginalTags?: boolean; // Keep original Google labels in addition to mapped tags
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
 * DTO for sync operation response
 */
export class SyncContactsResponseDto {
  success: boolean;
  added: number;
  updated: number;
  deleted: number;
  syncedAt: Date;
  syncToken?: string;
  duration?: number;
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
  orgSlug?: string; // Organization slug for redirect
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
}
