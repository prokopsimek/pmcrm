import { IsString, IsBoolean, IsOptional, IsNotEmpty, MaxLength, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new saved view
 * US-061: Advanced Filtering
 */
export class CreateSavedViewDto {
  @ApiProperty({
    description: 'Name of the saved view',
    example: 'Hot leads',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Filter configuration object',
    example: {
      tags: ['client', 'priority'],
      company: 'Acme',
      hasEmail: true,
    },
  })
  @IsObject()
  filters: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Whether this view should be the default',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
