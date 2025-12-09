import { ContactFilters } from './contact';

/**
 * SavedView type
 * US-061: Advanced Filtering
 *
 * Represents a saved filter configuration
 */
export interface SavedView {
  id: string;
  name: string;
  filters: ContactFilters;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input type for creating a new saved view
 */
export interface CreateSavedViewInput {
  name: string;
  filters: ContactFilters;
  isDefault?: boolean;
}

/**
 * Input type for updating an existing saved view
 */
export interface UpdateSavedViewInput {
  name?: string;
  filters?: ContactFilters;
  isDefault?: boolean;
}












