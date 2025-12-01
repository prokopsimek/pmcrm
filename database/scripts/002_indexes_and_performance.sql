-- ============================================================================
-- Performance Indexes and Optimizations
-- Personal Network CRM
-- ============================================================================
--
-- This script creates additional indexes for query performance
-- and sets up full-text search capabilities
-- ============================================================================

-- ============================================================================
-- FULL-TEXT SEARCH SETUP
-- ============================================================================

-- Create custom text search configuration for contact search
CREATE TEXT SEARCH CONFIGURATION contact_search (COPY = english);

-- Update search vector on contact insert/update
CREATE OR REPLACE FUNCTION contacts_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('contact_search', coalesce(NEW.first_name, '')), 'A') ||
        setweight(to_tsvector('contact_search', coalesce(NEW.last_name, '')), 'A') ||
        setweight(to_tsvector('contact_search', coalesce(NEW.email, '')), 'B') ||
        setweight(to_tsvector('contact_search', coalesce(NEW.nickname, '')), 'B') ||
        setweight(to_tsvector('contact_search', coalesce(NEW.phone, '')), 'C') ||
        setweight(to_tsvector('contact_search', coalesce(NEW.city, '')), 'C') ||
        setweight(to_tsvector('contact_search', coalesce(NEW.notes, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search vector
CREATE TRIGGER contacts_search_vector_trigger
    BEFORE INSERT OR UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION contacts_search_vector_update();

-- ============================================================================
-- ADDITIONAL PERFORMANCE INDEXES
-- ============================================================================

-- Contacts - Common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_full_name
    ON contacts (user_id, first_name, last_name)
    WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_relationship_tier
    ON contacts (user_id, relationship_tier)
    WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_next_contact
    ON contacts (user_id, next_contact_date)
    WHERE deleted_at IS NULL AND next_contact_date IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_birthday
    ON contacts (user_id, birthday)
    WHERE deleted_at IS NULL AND birthday IS NOT NULL;

-- Organizations - Lookup patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_name_trgm
    ON organizations USING gin (name gin_trgm_ops)
    WHERE deleted_at IS NULL;

-- Interactions - Timeline and analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interactions_type_occurred
    ON interactions (user_id, interaction_type, occurred_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interactions_external_lookup
    ON interactions (external_source, external_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interactions_sentiment
    ON interactions (user_id, sentiment_label, occurred_at DESC)
    WHERE sentiment_label IS NOT NULL;

-- Reminders - Due date queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reminders_status_priority
    ON reminders (user_id, status, priority, due_at)
    WHERE status = 'pending';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reminders_upcoming
    ON reminders (user_id, due_at)
    WHERE status = 'pending' AND due_at > NOW();

-- AI Insights - Priority and freshness
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_insights_active
    ON ai_insights (user_id, status, priority, created_at DESC)
    WHERE status = 'pending' AND (expires_at IS NULL OR expires_at > NOW());

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_insights_type_status
    ON ai_insights (user_id, insight_type, status, created_at DESC);

-- Audit Logs - Investigation and compliance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_event
    ON audit_logs (user_id, event_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity
    ON audit_logs (entity_type, entity_id, created_at DESC);

-- Integrations - Active lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_provider_active
    ON integrations (user_id, provider, is_active);

-- ============================================================================
-- PARTIAL INDEXES FOR SOFT DELETE
-- ============================================================================

-- These indexes exclude soft-deleted records for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_active
    ON contacts (user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_active
    ON organizations (user_id)
    WHERE deleted_at IS NULL;

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON JOINS
-- ============================================================================

-- Contact Employments - Current position lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_employments_current
    ON contact_employments (contact_id, is_current)
    WHERE is_current = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_employments_org_current
    ON contact_employments (organization_id, is_current)
    WHERE is_current = true;

-- Interaction Participants - Contact activity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interaction_participants_contact
    ON interaction_participants (contact_id, interaction_id);

-- Contact Tags - Tag filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_tags_tag_user
    ON contact_tags (tag_id, user_id);

-- ============================================================================
-- JSONB INDEXES FOR ENRICHMENT DATA
-- ============================================================================

-- GIN indexes for JSONB columns enable efficient querying of enrichment data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_enrichment_data
    ON contacts USING gin (enrichment_data);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_enrichment_data
    ON organizations USING gin (enrichment_data);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interactions_metadata
    ON interactions USING gin (metadata);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_insights_reasoning
    ON ai_insights USING gin (reasoning);

-- ============================================================================
-- STATISTICS UPDATES
-- ============================================================================

-- Analyze tables to update query planner statistics
ANALYZE contacts;
ANALYZE organizations;
ANALYZE contact_employments;
ANALYZE interactions;
ANALYZE interaction_participants;
ANALYZE reminders;
ANALYZE ai_insights;
ANALYZE tags;
ANALYZE contact_tags;
ANALYZE integrations;
ANALYZE consent_records;
ANALYZE audit_logs;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION contacts_search_vector_update() IS
    'Automatically updates the full-text search vector for contacts on insert/update';

COMMENT ON INDEX idx_contacts_search IS
    'GIN index for full-text search on contacts (names, email, phone, notes)';
