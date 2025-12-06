/**
 * Contact Types
 */

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  notes?: string;
  tags?: string[];
  avatar?: string;
  lastContactedAt?: string;
  importance?: number; // 0-100 relationship strength score
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateContactInput extends Partial<CreateContactInput> {
  id: string;
}

/**
 * Contact source enum
 * US-061: Advanced Filtering
 */
export type ContactSource =
  | 'MANUAL'
  | 'IMPORT'
  | 'GOOGLE_CONTACTS'
  | 'GOOGLE_CALENDAR'
  | 'MICROSOFT_CONTACTS'
  | 'MICROSOFT_CALENDAR'
  | 'LINKEDIN'
  | 'EMAIL'
  | 'API';

/**
 * Extended contact filters
 * US-061: Advanced Filtering
 */
export interface ContactFilters {
  // Text search
  search?: string;
  // Tag filter (OR logic)
  tags?: string[];
  // Company partial match
  company?: string;
  // Position partial match
  position?: string;
  // Location partial match
  location?: string;
  // Source exact match
  source?: ContactSource;
  // Has email
  hasEmail?: boolean;
  // Has phone
  hasPhone?: boolean;
  // Last contacted date range
  lastContactedFrom?: string; // ISO date
  lastContactedTo?: string; // ISO date
  // Sorting
  sortBy?: 'lastContact' | 'importance' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
