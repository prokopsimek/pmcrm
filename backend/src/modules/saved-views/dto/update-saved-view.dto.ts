import { IsString, IsBoolean, IsOptional, MaxLength, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating an existing saved view
 * US-061: Advanced Filtering
 */
export class UpdateSavedViewDto {
  @ApiPropertyOptional({
    description: 'Name of the saved view',
    example: 'Hot leads updated',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Filter configuration object',
    example: {
      tags: ['client'],
      hasEmail: true,
    },
  })
  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Whether this view should be the default',
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}



