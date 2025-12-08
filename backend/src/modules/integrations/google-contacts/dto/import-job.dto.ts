import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Import job status enum
 */
export type ImportJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Response DTO when initiating an import job
 */
export class ImportJobResponseDto {
  @ApiProperty({ description: 'Unique job identifier' })
  jobId: string;

  @ApiProperty({
    description: 'Current job status',
    enum: ['queued', 'processing', 'completed', 'failed'],
  })
  status: ImportJobStatus;

  @ApiProperty({ description: 'Human-readable status message' })
  message: string;
}

/**
 * Error details for failed contact imports
 */
export class ImportJobErrorDto {
  @ApiProperty({ description: 'External contact ID that failed' })
  contactId: string;

  @ApiProperty({ description: 'Error message' })
  error: string;
}

/**
 * Detailed job status response for polling
 */
export class ImportJobStatusDto {
  @ApiProperty({ description: 'Unique job identifier' })
  jobId: string;

  @ApiProperty({
    description: 'Current job status',
    enum: ['queued', 'processing', 'completed', 'failed'],
  })
  status: ImportJobStatus;

  @ApiProperty({ description: 'Total contacts to import' })
  totalCount: number;

  @ApiProperty({ description: 'Contacts processed so far' })
  processedCount: number;

  @ApiProperty({ description: 'Successfully imported contacts' })
  importedCount: number;

  @ApiProperty({ description: 'Skipped contacts (duplicates)' })
  skippedCount: number;

  @ApiProperty({ description: 'Failed contact imports' })
  failedCount: number;

  @ApiProperty({
    description: 'Progress percentage (0-100)',
    minimum: 0,
    maximum: 100,
  })
  progress: number;

  @ApiPropertyOptional({
    description: 'Array of recent errors',
    type: [ImportJobErrorDto],
  })
  errors?: ImportJobErrorDto[];

  @ApiPropertyOptional({ description: 'Job start timestamp' })
  startedAt?: Date;

  @ApiPropertyOptional({ description: 'Job completion timestamp' })
  completedAt?: Date;

  @ApiProperty({ description: 'Job creation timestamp' })
  createdAt: Date;
}


