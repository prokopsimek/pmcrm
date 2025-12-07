import { IsArray, IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

/**
 * OAuth connection response DTO
 */
export class CalendarConnectionResponseDto {
  @IsString()
  authUrl: string;

  @IsString()
  state: string;

  @IsOptional()
  @IsArray()
  scopes?: string[];
}

/**
 * OAuth callback result DTO
 */
export class CalendarCallbackResponseDto {
  @IsBoolean()
  success: boolean;

  @IsString()
  integrationId: string;

  @IsOptional()
  @IsString()
  message?: string;
}

/**
 * Calendar sync result DTO (synchronous response)
 */
export class CalendarSyncResultDto {
  synced: number;
  added?: number;
  updated?: number;
  deleted?: number;
  skipped?: boolean;
  syncedAt: Date;
}

/**
 * Calendar sync job status type
 */
export type CalendarSyncJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Calendar sync job response DTO (async background job)
 */
export class CalendarSyncJobResponseDto {
  @IsString()
  jobId: string;

  @IsString()
  status: CalendarSyncJobStatus;

  @IsString()
  message: string;
}

/**
 * Calendar disconnect result DTO
 */
export class CalendarDisconnectResultDto {
  @IsBoolean()
  success: boolean;

  @IsBoolean()
  tokensRevoked: boolean;

  @IsOptional()
  @IsString()
  warning?: string;
}

/**
 * Calendar status response DTO
 */
export class CalendarStatusResponseDto {
  @IsBoolean()
  isConnected: boolean;

  @IsOptional()
  @IsString()
  provider?: string; // 'google', 'outlook'

  @IsOptional()
  totalMeetings: number;

  @IsOptional()
  @IsDateString()
  lastSyncAt?: Date;

  @IsBoolean()
  syncEnabled: boolean;

  @IsOptional()
  @IsBoolean()
  isConfigured?: boolean; // true if calendars are selected

  @IsOptional()
  @IsArray()
  selectedCalendarIds?: string[];
}
