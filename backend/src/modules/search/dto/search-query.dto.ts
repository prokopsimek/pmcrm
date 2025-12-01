import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  Min,
  MinLength,
  IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SearchQueryDto {
  @ApiProperty({
    description: 'Search query string',
    example: 'john doe',
    minLength: 2,
  })
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters long' })
  q: string;

  @ApiPropertyOptional({
    description: 'Fields to search in (comma-separated)',
    example: 'name,email,company',
    enum: ['name', 'email', 'company', 'tags', 'notes'],
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim());
    }
    return value;
  })
  @IsArray()
  @IsIn(['name', 'email', 'company', 'tags', 'notes'], { each: true })
  fields?: string[];

  @ApiPropertyOptional({
    description: 'Enable fuzzy search for typo tolerance',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  fuzzy?: boolean;

  @ApiPropertyOptional({
    description: 'Enable result highlighting',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  highlight?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export interface SearchResult<T = any> {
  results: T[];
  total: number;
  query: string;
  duration?: number;
}

export interface HighlightedContact {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  tags?: string[];
  notes?: string;
}

export interface ContactSearchResult {
  id: string;
  userId: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  position?: string | null;
  location?: string | null;
  notes?: string | null;
  tags: string[];
  rank?: number;
  highlighted?: HighlightedContact;
  createdAt: Date;
  updatedAt: Date;
}

export class SearchHistoryItem {
  @ApiProperty({ description: 'Search history item ID' })
  id!: string;

  @ApiProperty({ description: 'Search query' })
  query!: string;

  @ApiProperty({ description: 'Number of results returned' })
  resultCount!: number;

  @ApiProperty({ description: 'When the search was performed' })
  createdAt!: Date;
}

/**
 * DTO for semantic search queries
 */
export class SemanticSearchDto {
  @ApiProperty({
    description: 'Search query for semantic search',
    example: 'software engineers in Prague',
    minLength: 2,
  })
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters long' })
  q: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Minimum similarity threshold (0-1)',
    example: 0.7,
    default: 0.7,
  })
  @IsOptional()
  @Type(() => Number)
  threshold?: number = 0.7;
}

/**
 * DTO for hybrid search (combines full-text + semantic)
 */
export class HybridSearchDto {
  @ApiProperty({
    description: 'Search query for hybrid search',
    example: 'CTOs in fintech startups',
    minLength: 2,
  })
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters long' })
  q: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Weight of semantic search vs full-text (0-1, 0.5 = equal weight)',
    example: 0.5,
    default: 0.5,
  })
  @IsOptional()
  @Type(() => Number)
  semanticWeight?: number = 0.5;
}

/**
 * Contact search result with similarity score
 */
export interface SemanticSearchResult extends ContactSearchResult {
  similarity?: number; // Cosine similarity score (0-1)
  distance?: number; // Vector distance (lower is better)
}
