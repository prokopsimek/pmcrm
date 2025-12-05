import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating an existing note
 * US-034: Manual Notes
 */
export class UpdateNoteDto {
  @ApiPropertyOptional({
    description: 'HTML content from rich text editor',
    example: '<p>Updated note content with new information.</p>',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50000, { message: 'Note content cannot exceed 50,000 characters' })
  content?: string;

  @ApiPropertyOptional({
    description: 'Whether the note should be pinned to top',
  })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}


