import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Calendar list item DTO
 */
export class CalendarListItemDto {
  @ApiProperty({ description: 'Calendar ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Calendar name/summary' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Calendar description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Whether this is the primary calendar' })
  @IsBoolean()
  isPrimary: boolean;

  @ApiPropertyOptional({ description: 'Calendar color (hex)' })
  @IsOptional()
  @IsString()
  color?: string;
}

/**
 * Response DTO for listing available calendars
 */
export class CalendarListResponseDto {
  @ApiProperty({ type: [CalendarListItemDto], description: 'List of available calendars' })
  @IsArray()
  calendars: CalendarListItemDto[];
}

/**
 * Request DTO for updating calendar selection
 */
export class UpdateCalendarSelectionDto {
  @ApiProperty({
    type: [String],
    description: 'IDs of calendars to use for contact import',
    example: ['primary', 'work@gmail.com'],
  })
  @IsArray()
  @IsString({ each: true })
  selectedCalendarIds: string[];

  @ApiPropertyOptional({
    description: 'Number of days back to sync events/contacts (1-365)',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  syncPeriodDays?: number;
}

/**
 * Response DTO for calendar configuration
 */
export class CalendarConfigResponseDto {
  @ApiProperty({
    type: [String],
    description: 'IDs of selected calendars',
  })
  @IsArray()
  selectedCalendarIds: string[];

  @ApiProperty({ description: 'Whether sync is enabled (true after calendars are selected)' })
  @IsBoolean()
  syncEnabled: boolean;

  @ApiProperty({ description: 'Whether the calendar integration is configured (calendars selected)' })
  @IsBoolean()
  isConfigured: boolean;

  @ApiProperty({
    description: 'Number of days back to sync events/contacts',
    example: 30,
  })
  @IsInt()
  syncPeriodDays: number;

  @ApiPropertyOptional({ description: 'Last event sync timestamp' })
  @IsOptional()
  lastSyncAt?: Date;

  @ApiPropertyOptional({ description: 'When contacts were last imported from calendar events' })
  @IsOptional()
  lastContactImportAt?: Date;
}

