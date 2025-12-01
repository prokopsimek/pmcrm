import { IsOptional, IsString, IsArray } from 'class-validator';

/**
 * DTO for import preview request query parameters
 */
export class ImportPreviewQueryDto {
  @IsOptional()
  @IsString()
  folderId?: string; // Filter by specific Microsoft contact folder

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[]; // Filter by specific categories
}

/**
 * Response DTO for import preview
 */
export class ImportPreviewResponseDto {
  totalFetched: number;
  newContacts: PreviewContactDto[];
  duplicates: DuplicateMatchDto[];
  summary: ImportSummaryDto;
  tagsPreview: string[]; // Outlook categories that will be imported
  sharedFolders: string[]; // Available shared address books
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
  tags: string[]; // Mapped from Outlook categories
  metadata?: Record<string, any>;
  folder?: string; // Contact folder name
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
