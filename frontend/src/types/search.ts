export interface SearchOptions {
  fields?: ('name' | 'email' | 'company' | 'tags' | 'notes')[];
  fuzzy?: boolean;
  highlight?: boolean;
  limit?: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  resultCount: number;
  createdAt: string;
}
