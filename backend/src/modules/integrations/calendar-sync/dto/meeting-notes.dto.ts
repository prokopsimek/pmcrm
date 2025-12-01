import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

/**
 * Add meeting notes DTO
 */
export class AddMeetingNotesDto {
  @IsString()
  @MaxLength(10000, { message: 'Notes cannot exceed 10,000 characters' })
  notes: string;

  @IsOptional()
  @IsBoolean()
  append?: boolean; // If true, append to existing notes instead of replacing
}

/**
 * Meeting notes response DTO
 */
export class MeetingNotesResponseDto {
  @IsString()
  id: string;

  @IsString()
  summary: string;

  updatedAt: Date;
}
