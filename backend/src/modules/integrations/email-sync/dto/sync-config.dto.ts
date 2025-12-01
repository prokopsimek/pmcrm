/**
 * Email sync configuration DTOs
 * US-030: Email communication sync
 */

import { IsBoolean, IsOptional, IsArray, IsString, IsEnum } from 'class-validator';

export class UpdateSyncConfigDto {
  @IsOptional()
  @IsBoolean()
  gmailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  outlookEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  privacyMode?: boolean;

  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedEmails?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedDomains?: string[];
}

export class ConnectProviderDto {
  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  redirectUri?: string;
}

export class ExcludeContactDto {
  @IsString()
  email: string;
}

export class TriggerSyncDto {
  @IsOptional()
  @IsEnum(['gmail', 'outlook', 'both'])
  provider?: 'gmail' | 'outlook' | 'both';

  @IsOptional()
  @IsBoolean()
  fullSync?: boolean; // If true, ignore history tokens and sync all
}
