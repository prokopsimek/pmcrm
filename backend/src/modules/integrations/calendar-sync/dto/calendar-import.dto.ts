import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * Query parameters for calendar contacts preview
 */
export class CalendarContactsPreviewQueryDto {
  @ApiProperty({
    description: 'Start date for the period to scan (ISO 8601 format)',
    example: '2024-09-01T00:00:00.000Z',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    description: 'End date for the period to scan (defaults to now)',
    example: '2024-12-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * Request body for importing contacts from calendar
 */
export class ImportCalendarContactsDto {
  @ApiProperty({
    description: 'Start date for the period to scan (ISO 8601 format)',
    example: '2024-09-01T00:00:00.000Z',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    description: 'End date for the period to scan (defaults to now)',
    example: '2024-12-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Skip contacts that already exist (based on email)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  skipDuplicates?: boolean;

  @ApiPropertyOptional({
    description: 'List of specific attendee emails to import (if empty, imports all)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedEmails?: string[];
}

/**
 * Preview attendee DTO - represents a potential contact from calendar
 */
export class PreviewAttendeeDto {
  @ApiProperty({ description: 'Email address of the attendee' })
  email: string;

  @ApiPropertyOptional({ description: 'Display name from calendar' })
  displayName?: string;

  @ApiProperty({ description: 'Parsed first name' })
  firstName: string;

  @ApiPropertyOptional({ description: 'Parsed last name' })
  lastName?: string;

  @ApiProperty({ description: 'Number of meetings with this person' })
  meetingCount: number;

  @ApiProperty({ description: 'Date of the last meeting' })
  lastMeetingDate: Date;

  @ApiProperty({ description: 'Date of the first meeting' })
  firstMeetingDate: Date;

  @ApiPropertyOptional({ description: 'Company extracted from email domain' })
  company?: string;
}

/**
 * Existing contact reference for duplicate matching
 */
export class ExistingCalendarContactDto {
  @ApiProperty({ description: 'Contact ID' })
  id: string;

  @ApiProperty({ description: 'First name' })
  firstName: string;

  @ApiPropertyOptional({ description: 'Last name' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  email?: string;

  @ApiPropertyOptional({ description: 'Company' })
  company?: string;

  @ApiProperty({ description: 'Contact source' })
  source: string;
}

/**
 * Duplicate match information for calendar contacts
 */
export class CalendarDuplicateMatchDto {
  @ApiProperty({ description: 'Attendee from calendar' })
  attendee: PreviewAttendeeDto;

  @ApiProperty({ description: 'Existing contact that matches' })
  existingContact: ExistingCalendarContactDto;

  @ApiProperty({ description: 'Match type', enum: ['EXACT', 'POTENTIAL'] })
  matchType: 'EXACT' | 'POTENTIAL';
}

/**
 * Summary statistics for calendar contacts preview
 */
export class CalendarImportSummaryDto {
  @ApiProperty({ description: 'Total number of calendar events scanned' })
  totalEvents: number;

  @ApiProperty({ description: 'Total unique attendees found' })
  totalAttendees: number;

  @ApiProperty({ description: 'Number of new contacts (not in CRM yet)' })
  newContacts: number;

  @ApiProperty({ description: 'Number of exact duplicates (same email exists)' })
  exactDuplicates: number;

  @ApiProperty({ description: 'Start date of scanned period' })
  periodStart: Date;

  @ApiProperty({ description: 'End date of scanned period' })
  periodEnd: Date;
}

/**
 * Response DTO for calendar contacts preview
 */
export class CalendarContactsPreviewResponseDto {
  @ApiProperty({ description: 'Import summary statistics' })
  summary: CalendarImportSummaryDto;

  @ApiProperty({
    description: 'New contacts that will be created',
    type: [PreviewAttendeeDto],
  })
  newContacts: PreviewAttendeeDto[];

  @ApiProperty({
    description: 'Attendees that match existing contacts',
    type: [CalendarDuplicateMatchDto],
  })
  duplicates: CalendarDuplicateMatchDto[];
}

/**
 * Response DTO for calendar contacts import
 */
export class ImportCalendarContactsResponseDto {
  @ApiProperty({ description: 'Whether the import was successful' })
  success: boolean;

  @ApiProperty({ description: 'Number of contacts imported' })
  imported: number;

  @ApiProperty({ description: 'Number of contacts skipped (duplicates)' })
  skipped: number;

  @ApiProperty({ description: 'Number of contacts that failed to import' })
  failed: number;

  @ApiPropertyOptional({
    description: 'Error messages for failed imports',
    type: [String],
  })
  errors?: string[];

  @ApiProperty({ description: 'Duration of the import in milliseconds' })
  @IsNumber()
  duration: number;

  @ApiProperty({ description: 'Timestamp of the import' })
  timestamp: Date;
}


