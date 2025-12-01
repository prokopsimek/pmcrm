import { IsOptional, IsString, IsArray } from 'class-validator';

/**
 * DTO for import preview request query parameters
 */
export class ImportPreviewQueryDto {
  @IsOptional()
  @IsString()
  groupId?: string; // Filter by specific Google contact group

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labelIds?: string[]; // Filter by specific labels
}

/**
 * Response DTO for import preview
 */
export class ImportPreviewResponseDto {
  totalFetched: number;
  newContacts: PreviewContactDto[];
  duplicates: DuplicateMatchDto[];
  summary: ImportSummaryDto;
  tagsPreview: string[];
}

/**
 * Contact preview DTO
 */
export class PreviewContactDto {
  externalId: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  tags: string[];
  metadata?: Record<string, any>;
}

/**
 * Duplicate match information
 */
export class DuplicateMatchDto {
  importedContact: PreviewContactDto;
  existingContact: ExistingContactDto;
  similarity: number; // 0.0 - 1.0
  matchType: 'EXACT' | 'POTENTIAL' | 'FUZZY';
  matchedFields: string[];
  confidence?: number;
}

/**
 * Existing contact reference
 */
export class ExistingContactDto {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  source: string;
}

/**
 * Import summary statistics
 */
export class ImportSummaryDto {
  total: number;
  new: number;
  exactDuplicates: number;
  potentialDuplicates: number;
}
