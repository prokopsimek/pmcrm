-- Migration: Add full-text search indexes for contacts
-- US-060: Fulltext search in contacts
-- Date: 2025-01-29

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add search_vector column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE contacts ADD COLUMN search_vector tsvector;
  END IF;
END $$;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION contacts_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.first_name, '') || ' ' ||
    COALESCE(NEW.last_name, '') || ' ' ||
    COALESCE(NEW.email, '') || ' ' ||
    COALESCE(NEW.company, '') || ' ' ||
    COALESCE(NEW.position, '') || ' ' ||
    COALESCE(NEW.notes, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search_vector
DROP TRIGGER IF EXISTS contacts_search_vector_trigger ON contacts;
CREATE TRIGGER contacts_search_vector_trigger
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION contacts_search_vector_update();

-- Create GIN index on search_vector for fast full-text search
CREATE INDEX IF NOT EXISTS idx_contacts_search_vector
  ON contacts USING GIN (search_vector);

-- Create GIN indexes for trigram similarity (fuzzy search)
CREATE INDEX IF NOT EXISTS idx_contacts_first_name_trgm
  ON contacts USING GIN (first_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_last_name_trgm
  ON contacts USING GIN (last_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm
  ON contacts USING GIN (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_company_trgm
  ON contacts USING GIN (company gin_trgm_ops);

-- Create standard B-tree indexes for exact matches
CREATE INDEX IF NOT EXISTS idx_contacts_first_name
  ON contacts (first_name);

CREATE INDEX IF NOT EXISTS idx_contacts_last_name
  ON contacts (last_name);

-- Create composite index for user + search performance
CREATE INDEX IF NOT EXISTS idx_contacts_user_search
  ON contacts (user_id, deleted_at) WHERE deleted_at IS NULL;

-- Update existing contacts with search_vector
UPDATE contacts
SET search_vector = to_tsvector('english',
  COALESCE(first_name, '') || ' ' ||
  COALESCE(last_name, '') || ' ' ||
  COALESCE(email, '') || ' ' ||
  COALESCE(company, '') || ' ' ||
  COALESCE(position, '') || ' ' ||
  COALESCE(notes, '') || ' ' ||
  COALESCE(array_to_string(tags, ' '), '')
)
WHERE search_vector IS NULL;

-- Create index on search_history for user lookups
CREATE INDEX IF NOT EXISTS idx_search_history_user_created
  ON search_history (user_id, created_at DESC);

-- Analyze tables to update statistics
ANALYZE contacts;
ANALYZE search_history;

-- Grant necessary permissions (adjust as needed for your environment)
-- GRANT SELECT ON contacts TO your_app_user;
-- GRANT SELECT, INSERT, DELETE ON search_history TO your_app_user;

COMMENT ON COLUMN contacts.search_vector IS 'Full-text search vector for efficient text search';
COMMENT ON INDEX idx_contacts_search_vector IS 'GIN index for full-text search performance';
COMMENT ON INDEX idx_contacts_first_name_trgm IS 'Trigram index for fuzzy search on first name';
COMMENT ON INDEX idx_contacts_last_name_trgm IS 'Trigram index for fuzzy search on last name';
COMMENT ON INDEX idx_contacts_email_trgm IS 'Trigram index for fuzzy search on email';
COMMENT ON INDEX idx_contacts_company_trgm IS 'Trigram index for fuzzy search on company';
