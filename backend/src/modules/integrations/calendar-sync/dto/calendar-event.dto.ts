import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Calendar attendee DTO
 */
export class CalendarAttendeeDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  responseStatus?: string; // 'accepted', 'declined', 'tentative', 'needsAction'

  @IsOptional()
  @IsBoolean()
  organizer?: boolean;

  @IsOptional()
  @IsBoolean()
  optional?: boolean;
}

/**
 * Calendar event response DTO
 */
export class CalendarEventDto {
  @IsString()
  externalId: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startTime: Date;

  @IsDateString()
  endTime: Date;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarAttendeeDto)
  attendees?: CalendarAttendeeDto[];

  @IsOptional()
  @IsString()
  externalSource?: string; // 'google_calendar', 'outlook_calendar'

  @IsOptional()
  metadata?: any;

  @IsOptional()
  @IsString()
  notes?: string; // Meeting notes if available

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  recurringEventId?: string;

  @IsOptional()
  @IsString()
  htmlLink?: string;
}

/**
 * Fetch events query DTO
 */
export class FetchEventsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  maxResults?: string;

  @IsOptional()
  @IsString()
  pageToken?: string;

  @IsOptional()
  @IsString()
  syncToken?: string;
}

/**
 * Fetch events response DTO
 */
export class FetchEventsResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarEventDto)
  events: CalendarEventDto[];

  @IsOptional()
  @IsString()
  nextPageToken?: string;

  @IsOptional()
  @IsString()
  nextSyncToken?: string;

  @IsOptional()
  @IsString()
  nextLink?: string; // For Outlook Calendar pagination

  total: number;
}
