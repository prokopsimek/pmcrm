import { IsString, IsBoolean, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new note on a contact
 * US-034: Manual Notes
 */
export class CreateNoteDto {
  @ApiProperty({
    description: 'HTML content from rich text editor',
    example: '<p>Met at conference, discussed partnership opportunities.</p>',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000, { message: 'Note content cannot exceed 50,000 characters' })
  content: string;

  @ApiPropertyOptional({
    description: 'Whether the note should be pinned to top',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}





