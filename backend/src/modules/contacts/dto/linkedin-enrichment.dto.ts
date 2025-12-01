import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUrl, IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';

// ============================================================================
// US-013: LinkedIn Enrichment DTOs
// ============================================================================

/**
 * DTO for manual LinkedIn enrichment by URL
 */
export class LinkedInEnrichmentDto {
  @ApiProperty({
    description: 'LinkedIn profile URL',
    example: 'https://www.linkedin.com/in/john-doe',
  })
  @IsUrl()
  linkedinUrl: string;
}

/**
 * Enriched LinkedIn profile data result
 */
export class LinkedInEnrichmentResult {
  @ApiPropertyOptional({ description: 'First name' })
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Professional headline' })
  headline?: string;

  @ApiPropertyOptional({ description: 'Profile summary/bio' })
  summary?: string;

  @ApiPropertyOptional({ description: 'Location (city, country)' })
  location?: string;

  @ApiPropertyOptional({ description: 'Profile photo URL' })
  photoUrl?: string;

  @ApiPropertyOptional({ description: 'Current position' })
  currentPosition?: {
    company: string;
    title: string;
    startDate?: string;
    isCurrent: boolean;
  };

  @ApiPropertyOptional({ description: 'Employment history (last 3-5 positions)' })
  positions?: Array<{
    company: string;
    title: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    isCurrent: boolean;
  }>;

  @ApiPropertyOptional({ description: 'Top 5 skills' })
  skills?: string[];

  @ApiPropertyOptional({ description: 'Education history' })
  education?: Array<{
    school: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
  }>;

  @ApiProperty({ description: 'Enrichment success status' })
  success: boolean;

  @ApiProperty({ description: 'Data source (proxycurl, apollo, cache)' })
  source: string;

  @ApiPropertyOptional({ description: 'Match score for auto-enrichment (0-1)' })
  matchScore?: number;
}

/**
 * Enrichment status DTO
 */
export class EnrichmentStatusDto {
  @ApiProperty({ description: 'Whether contact has been enriched' })
  isEnriched: boolean;

  @ApiPropertyOptional({ description: 'Last enrichment timestamp' })
  lastUpdate: Date | null;

  @ApiPropertyOptional({ description: 'Enrichment provider used' })
  provider: string | null;

  @ApiProperty({ description: 'Whether cache is still valid (within 30 days)' })
  cacheValid: boolean;

  @ApiProperty({ description: 'Days until cache expiry (negative if expired)' })
  daysUntilExpiry: number;
}

/**
 * Auto-match result DTO
 */
export class AutoMatchResultDto {
  @ApiPropertyOptional({ description: 'Matched LinkedIn URL' })
  linkedinUrl: string | null;

  @ApiProperty({ description: 'Match confidence score (0-1)' })
  matchScore: number;

  @ApiProperty({ description: 'Match method used (email, name)' })
  matchMethod: 'email' | 'name' | 'none';
}

/**
 * Enrichment cost tracking DTO
 */
export class EnrichmentCostDto {
  @ApiProperty({ description: 'Total cost of all enrichments' })
  totalCost: number;

  @ApiProperty({ description: 'Number of successful enrichments' })
  successfulEnrichments: number;

  @ApiProperty({ description: 'Number of failed enrichments' })
  failedEnrichments: number;

  @ApiProperty({ description: 'Current month cost' })
  currentMonthCost: number;

  @ApiProperty({ description: 'Average cost per enrichment' })
  averageCostPerEnrichment: number;

  @ApiPropertyOptional({ description: 'Breakdown by provider' })
  byProvider?: {
    [provider: string]: {
      count: number;
      cost: number;
    };
  };
}
