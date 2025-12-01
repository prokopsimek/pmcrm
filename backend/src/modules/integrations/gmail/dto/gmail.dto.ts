import { IsBoolean, IsOptional, IsArray, IsString, IsEnum } from 'class-validator';

/**
 * DTO for updating Gmail sync configuration
 */
export class UpdateGmailConfigDto {
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  privacyMode?: boolean; // true = metadata only, false = full content

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedEmails?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedDomains?: string[];
}

/**
 * DTO for triggering email sync
 */
export class TriggerSyncDto {
  @IsOptional()
  @IsBoolean()
  fullSync?: boolean; // Force full sync instead of incremental

  @IsOptional()
  @IsString()
  contactId?: string; // Sync emails for specific contact only
}

/**
 * DTO for OAuth initiation response
 */
export class GmailOAuthInitiateResponseDto {
  authUrl: string;
  state: string;
}

/**
 * DTO for OAuth callback response
 */
export class GmailOAuthCallbackResponseDto {
  success: boolean;
  integrationId: string;
  message: string;
}

/**
 * DTO for disconnect integration response
 */
export class GmailDisconnectResponseDto {
  success: boolean;
  tokensRevoked: boolean;
  emailsPreserved: boolean;
  message: string;
}

/**
 * DTO for Gmail integration status response
 */
export class GmailStatusResponseDto {
  isConnected: boolean;
  integrationId?: string;
  connectedAt?: Date;
  lastSyncAt?: Date;
  totalEmailsSynced: number;
  syncEnabled: boolean;
  privacyMode: boolean;
  isActive?: boolean;
}

/**
 * DTO for Gmail sync config response
 */
export class GmailConfigResponseDto {
  id: string;
  userId: string;
  gmailEnabled: boolean;
  syncEnabled: boolean;
  privacyMode: boolean;
  excludedEmails: string[];
  excludedDomains: string[];
  lastGmailSync: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for email sync result
 */
export class EmailSyncResultDto {
  success: boolean;
  provider: 'gmail';
  emailsProcessed: number;
  emailsStored: number;
  contactsMatched: number;
  errors: EmailSyncErrorDto[];
  duration?: number;
  syncedAt: Date;
  newHistoryId?: string;
}

/**
 * Email sync error details
 */
export class EmailSyncErrorDto {
  emailId?: string;
  contactId?: string;
  error: string;
  timestamp: Date;
}
