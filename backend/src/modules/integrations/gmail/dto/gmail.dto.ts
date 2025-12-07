import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

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

// ============================================================================
// BACKGROUND SYNC JOB DTOs
// ============================================================================

/**
 * DTO for queuing a Gmail background sync job
 */
export class QueueGmailSyncDto {
  @ApiPropertyOptional({ description: 'Force full sync instead of incremental' })
  @IsOptional()
  @IsBoolean()
  fullSync?: boolean;

  @ApiPropertyOptional({
    description: 'How many days back to sync (default: 365)',
    minimum: 1,
    maximum: 1825, // 5 years max
    default: 365,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1825)
  historyDays?: number;
}

/**
 * Import job status enum
 */
export type GmailSyncJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Response DTO when initiating a Gmail sync job
 */
export class GmailSyncJobResponseDto {
  @ApiProperty({ description: 'Unique job identifier' })
  jobId: string;

  @ApiProperty({
    description: 'Current job status',
    enum: ['queued', 'processing', 'completed', 'failed'],
  })
  status: GmailSyncJobStatus;

  @ApiProperty({ description: 'Human-readable status message' })
  message: string;
}

/**
 * Error details for failed email syncs
 */
export class GmailSyncJobErrorDto {
  @ApiPropertyOptional({ description: 'Email ID that failed' })
  emailId?: string;

  @ApiProperty({ description: 'Error message' })
  error: string;
}

/**
 * Detailed job status response for polling
 */
export class GmailSyncJobStatusDto {
  @ApiProperty({ description: 'Unique job identifier' })
  jobId: string;

  @ApiProperty({
    description: 'Current job status',
    enum: ['queued', 'processing', 'completed', 'failed'],
  })
  status: GmailSyncJobStatus;

  @ApiProperty({ description: 'Total emails to process' })
  totalCount: number;

  @ApiProperty({ description: 'Emails processed so far' })
  processedCount: number;

  @ApiProperty({ description: 'Successfully imported emails' })
  importedCount: number;

  @ApiProperty({ description: 'Skipped emails (no matching contacts)' })
  skippedCount: number;

  @ApiProperty({ description: 'Failed email imports' })
  failedCount: number;

  @ApiProperty({
    description: 'Progress percentage (0-100)',
    minimum: 0,
    maximum: 100,
  })
  progress: number;

  @ApiPropertyOptional({
    description: 'Array of recent errors',
    type: [GmailSyncJobErrorDto],
  })
  errors?: GmailSyncJobErrorDto[];

  @ApiPropertyOptional({ description: 'Job start timestamp' })
  startedAt?: Date;

  @ApiPropertyOptional({ description: 'Job completion timestamp' })
  completedAt?: Date;

  @ApiProperty({ description: 'Job creation timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, unknown>;
}
