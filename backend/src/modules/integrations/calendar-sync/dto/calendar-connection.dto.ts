import { IsString, IsOptional, IsBoolean, IsArray, IsDateString } from 'class-validator';

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
 * Calendar sync result DTO
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
}
