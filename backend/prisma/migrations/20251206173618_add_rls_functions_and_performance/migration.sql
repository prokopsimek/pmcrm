-- ============================================================================
-- RLS Functions, Performance Indexes, and Triggers
-- Personal Network CRM
-- ============================================================================
-- This migration adds:
-- 1. PostgreSQL extensions (with IF NOT EXISTS)
-- 2. RLS helper functions for multi-tenancy
-- 3. Row-Level Security policies for user-scoped tables
-- 4. Performance indexes for common query patterns
-- 5. Utility triggers for automatic timestamp updates
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable required extensions (safe with IF NOT EXISTS)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Note: vector extension is already enabled in 0001_init

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================

-- Function to set current user context for RLS
-- Call this at the beginning of each request: SELECT set_current_user_id('user-id')
CREATE OR REPLACE FUNCTION set_current_user_id(p_user_id TEXT)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user context
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to clear user context
CREATE OR REPLACE FUNCTION clear_current_user_id()
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', '', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_current_user_id(TEXT) IS
    'Sets the current user context for RLS. Call at request start: SELECT set_current_user_id(user_id)';

COMMENT ON FUNCTION get_current_user_id() IS
    'Returns the current user ID from session context';

COMMENT ON FUNCTION clear_current_user_id() IS
    'Clears the current user context';

-- ============================================================================
-- ROW-LEVEL SECURITY SETUP
-- ============================================================================

-- Enable RLS on user-scoped tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_icebreakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - CONTACTS
-- ============================================================================

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS tenant_isolation_contacts ON contacts;
DROP POLICY IF EXISTS contacts_soft_delete ON contacts;

CREATE POLICY tenant_isolation_contacts ON contacts
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- Only show non-deleted contacts by default
CREATE POLICY contacts_soft_delete ON contacts
    FOR SELECT
    USING ("deletedAt" IS NULL OR "userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - CONTACT ACTIVITIES
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_contact_activities ON contact_activities;

CREATE POLICY tenant_isolation_contact_activities ON contact_activities
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - INTEGRATIONS
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_integrations ON integrations;

CREATE POLICY tenant_isolation_integrations ON integrations
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - NOTIFICATIONS
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_notifications ON notifications;

CREATE POLICY tenant_isolation_notifications ON notifications
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - SEARCH HISTORY
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_search_history ON search_history;

CREATE POLICY tenant_isolation_search_history ON search_history
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - ONBOARDING STATES
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_onboarding_states ON onboarding_states;

CREATE POLICY tenant_isolation_onboarding_states ON onboarding_states
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - SUBSCRIPTIONS
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_subscriptions ON subscriptions;

CREATE POLICY tenant_isolation_subscriptions ON subscriptions
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - CALENDAR SYNC CONFIGS
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_calendar_sync_configs ON calendar_sync_configs;

CREATE POLICY tenant_isolation_calendar_sync_configs ON calendar_sync_configs
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - EMAIL SYNC CONFIGS
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_email_sync_configs ON email_sync_configs;

CREATE POLICY tenant_isolation_email_sync_configs ON email_sync_configs
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - INTERACTIONS
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_interactions ON interactions;

CREATE POLICY tenant_isolation_interactions ON interactions
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - COMPANIES
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_companies ON companies;

CREATE POLICY tenant_isolation_companies ON companies
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - TAGS
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_tags ON tags;

CREATE POLICY tenant_isolation_tags ON tags
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - CONTACT TAGS
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_contact_tags ON contact_tags;

CREATE POLICY tenant_isolation_contact_tags ON contact_tags
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - NOTES
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_notes ON notes;

CREATE POLICY tenant_isolation_notes ON notes
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - SAVED VIEWS
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_saved_views ON saved_views;

CREATE POLICY tenant_isolation_saved_views ON saved_views
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - GENERATED ICEBREAKERS
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_generated_icebreakers ON generated_icebreakers;

CREATE POLICY tenant_isolation_generated_icebreakers ON generated_icebreakers
    FOR ALL
    USING ("userId" = get_current_user_id())
    WITH CHECK ("userId" = get_current_user_id());

-- ============================================================================
-- RLS POLICIES - ENRICHMENT LOGS (via contact ownership)
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_enrichment_logs ON enrichment_logs;

CREATE POLICY tenant_isolation_enrichment_logs ON enrichment_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM contacts
            WHERE contacts.id = enrichment_logs."contactId"
            AND contacts."userId" = get_current_user_id()
        )
    );

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Contacts - Common query patterns
CREATE INDEX IF NOT EXISTS idx_contacts_user_deleted
    ON contacts ("userId", "deletedAt")
    WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_user_company
    ON contacts ("userId", company)
    WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_user_last_contact
    ON contacts ("userId", "lastContact" DESC NULLS LAST)
    WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_user_importance
    ON contacts ("userId", importance DESC)
    WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_user_frequency
    ON contacts ("userId", frequency DESC)
    WHERE "deletedAt" IS NULL;

-- Contacts - Full name search
CREATE INDEX IF NOT EXISTS idx_contacts_full_name_trgm
    ON contacts USING gin (("firstName" || ' ' || COALESCE("lastName", '')) gin_trgm_ops)
    WHERE "deletedAt" IS NULL;

-- Reminders - Status and scheduling
CREATE INDEX IF NOT EXISTS idx_reminders_contact_status
    ON reminders ("contactId", status)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_status
    ON reminders ("scheduledFor", status)
    WHERE status = 'PENDING';

-- Interactions - Timeline queries
CREATE INDEX IF NOT EXISTS idx_interactions_user_occurred
    ON interactions ("userId", "occurredAt" DESC);

CREATE INDEX IF NOT EXISTS idx_interactions_type_occurred
    ON interactions ("userId", "interactionType", "occurredAt" DESC);

-- AI Insights - Contact lookup
CREATE INDEX IF NOT EXISTS idx_ai_insights_contact_type
    ON ai_insights ("contactId", type, "createdAt" DESC);

-- Email Threads - Contact email history
CREATE INDEX IF NOT EXISTS idx_email_threads_contact_occurred
    ON email_threads ("contactId", "occurredAt" DESC);

-- Notes - Contact notes lookup
CREATE INDEX IF NOT EXISTS idx_notes_contact_pinned
    ON notes ("contactId", "isPinned" DESC, "createdAt" DESC);

-- Contact AI Summaries - Freshness check
CREATE INDEX IF NOT EXISTS idx_contact_ai_summaries_expires
    ON contact_ai_summaries ("contactId", "expiresAt")
    WHERE "expiresAt" IS NOT NULL;

-- Generated Icebreakers - Recent generations
CREATE INDEX IF NOT EXISTS idx_generated_icebreakers_contact_recent
    ON generated_icebreakers ("contactId", "createdAt" DESC);

-- Activity Logs - User activity
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created
    ON activity_logs ("userId", "createdAt" DESC);

-- ============================================================================
-- JSONB INDEXES
-- ============================================================================

-- Contacts - Enrichment data queries
CREATE INDEX IF NOT EXISTS idx_contacts_enrichment_data_gin
    ON contacts USING gin ("enrichmentData" jsonb_path_ops)
    WHERE "enrichmentData" IS NOT NULL;

-- Contacts - Metadata queries
CREATE INDEX IF NOT EXISTS idx_contacts_metadata_gin
    ON contacts USING gin (metadata jsonb_path_ops)
    WHERE metadata IS NOT NULL;

-- Interactions - Meeting data queries
CREATE INDEX IF NOT EXISTS idx_interactions_meeting_data_gin
    ON interactions USING gin ("meetingData" jsonb_path_ops)
    WHERE "meetingData" IS NOT NULL;

-- ============================================================================
-- AUTOMATIC TIMESTAMP UPDATE TRIGGER
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS
    'Automatically updates the updatedAt timestamp on row update';

-- Note: Prisma handles @updatedAt automatically, but these triggers
-- ensure consistency even for raw SQL updates

-- Apply to tables with updatedAt
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integrations_updated_at ON integrations;
CREATE TRIGGER update_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reminders_updated_at ON reminders;
CREATE TRIGGER update_reminders_updated_at
    BEFORE UPDATE ON reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_interactions_updated_at ON interactions;
CREATE TRIGGER update_interactions_updated_at
    BEFORE UPDATE ON interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
CREATE TRIGGER update_tags_updated_at
    BEFORE UPDATE ON tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_views_updated_at ON saved_views;
CREATE TRIGGER update_saved_views_updated_at
    BEFORE UPDATE ON saved_views
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SOFT DELETE HELPERS
-- ============================================================================

-- Function to soft delete a contact
CREATE OR REPLACE FUNCTION soft_delete_contact(p_contact_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE contacts
    SET "deletedAt" = NOW()
    WHERE id = p_contact_id
    AND "deletedAt" IS NULL;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to restore soft deleted contact
CREATE OR REPLACE FUNCTION restore_contact(p_contact_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE contacts
    SET "deletedAt" = NULL
    WHERE id = p_contact_id
    AND "deletedAt" IS NOT NULL;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to permanently delete old soft-deleted records (GDPR compliance)
CREATE OR REPLACE FUNCTION purge_deleted_contacts(p_days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM contacts
        WHERE "deletedAt" IS NOT NULL
        AND "deletedAt" < NOW() - (p_days_old || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION soft_delete_contact(TEXT) IS
    'Soft deletes a contact by setting deletedAt timestamp';

COMMENT ON FUNCTION restore_contact(TEXT) IS
    'Restores a soft-deleted contact by clearing deletedAt';

COMMENT ON FUNCTION purge_deleted_contacts(INTEGER) IS
    'Permanently deletes contacts that were soft-deleted more than N days ago (GDPR compliance)';

-- ============================================================================
-- FORCE RLS FOR ALL USERS (except superuser)
-- ============================================================================

ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE contact_activities FORCE ROW LEVEL SECURITY;
ALTER TABLE integrations FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE search_history FORCE ROW LEVEL SECURITY;
ALTER TABLE onboarding_states FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE email_sync_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE interactions FORCE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
ALTER TABLE tags FORCE ROW LEVEL SECURITY;
ALTER TABLE contact_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE notes FORCE ROW LEVEL SECURITY;
ALTER TABLE saved_views FORCE ROW LEVEL SECURITY;
ALTER TABLE generated_icebreakers FORCE ROW LEVEL SECURITY;
ALTER TABLE enrichment_logs FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

ANALYZE contacts;
ANALYZE contact_activities;
ANALYZE integrations;
ANALYZE notifications;
ANALYZE reminders;
ANALYZE interactions;
ANALYZE interaction_participants;
ANALYZE ai_insights;
ANALYZE email_threads;
ANALYZE notes;
ANALYZE tags;
ANALYZE contact_tags;
ANALYZE companies;
ANALYZE contact_employments;
ANALYZE generated_icebreakers;
ANALYZE saved_views;

