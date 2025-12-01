-- ============================================================================
-- Row-Level Security (RLS) Setup for Multi-Tenant Isolation
-- Personal Network CRM
-- ============================================================================
--
-- This script implements PostgreSQL Row-Level Security (RLS) policies
-- to ensure complete tenant isolation in a shared database architecture.
-- Each user can only access their own data.
--
-- IMPORTANT: Execute this script AFTER running Prisma migrations
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- ENABLE RLS ON ALL TENANT-SCOPED TABLES
-- ============================================================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_employments ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================

-- ====================
-- CONTACTS
-- ====================
CREATE POLICY tenant_isolation_contacts ON contacts
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

-- Only show non-deleted contacts by default
CREATE POLICY contacts_soft_delete ON contacts
    FOR SELECT
    USING (deleted_at IS NULL);

-- ====================
-- ORGANIZATIONS
-- ====================
CREATE POLICY tenant_isolation_organizations ON organizations
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY organizations_soft_delete ON organizations
    FOR SELECT
    USING (deleted_at IS NULL);

-- ====================
-- CONTACT_EMPLOYMENTS
-- ====================
-- Employment records are accessible if user owns the contact
CREATE POLICY tenant_isolation_contact_employments ON contact_employments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM contacts
            WHERE contacts.id = contact_employments.contact_id
            AND contacts.user_id = current_setting('app.current_user_id', true)::UUID
        )
    );

-- ====================
-- INTERACTIONS
-- ====================
CREATE POLICY tenant_isolation_interactions ON interactions
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

-- ====================
-- INTERACTION_PARTICIPANTS
-- ====================
-- Participants are accessible if user owns the interaction
CREATE POLICY tenant_isolation_interaction_participants ON interaction_participants
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM interactions
            WHERE interactions.id = interaction_participants.interaction_id
            AND interactions.user_id = current_setting('app.current_user_id', true)::UUID
        )
    );

-- ====================
-- REMINDERS
-- ====================
CREATE POLICY tenant_isolation_reminders ON reminders
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

-- ====================
-- AI_INSIGHTS
-- ====================
CREATE POLICY tenant_isolation_ai_insights ON ai_insights
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

-- ====================
-- TAGS
-- ====================
CREATE POLICY tenant_isolation_tags ON tags
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

-- ====================
-- CONTACT_TAGS
-- ====================
CREATE POLICY tenant_isolation_contact_tags ON contact_tags
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

-- ====================
-- INTEGRATIONS
-- ====================
CREATE POLICY tenant_isolation_integrations ON integrations
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

-- ====================
-- CONSENT_RECORDS
-- ====================
CREATE POLICY tenant_isolation_consent_records ON consent_records
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

-- ====================
-- AUDIT_LOGS
-- ====================
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    FOR ALL
    USING (
        user_id = current_setting('app.current_user_id', true)::UUID
        OR user_id IS NULL
    );

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Function to set current user context
-- Call this at the beginning of each request: SELECT set_current_user_id('user-uuid')
CREATE OR REPLACE FUNCTION set_current_user_id(p_user_id UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user context
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BYPASS RLS FOR SERVICE ROLE (for background jobs, migrations, etc.)
-- ============================================================================

-- Create a service role that can bypass RLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
    END IF;
END
$$;

-- Grant necessary permissions to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Service role can bypass RLS
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE contact_employments FORCE ROW LEVEL SECURITY;
ALTER TABLE interactions FORCE ROW LEVEL SECURITY;
ALTER TABLE interaction_participants FORCE ROW LEVEL SECURITY;
ALTER TABLE reminders FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_insights FORCE ROW LEVEL SECURITY;
ALTER TABLE tags FORCE ROW LEVEL SECURITY;
ALTER TABLE contact_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE integrations FORCE ROW LEVEL SECURITY;
ALTER TABLE consent_records FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY tenant_isolation_contacts ON contacts IS
    'Ensures users can only access their own contacts';

COMMENT ON POLICY contacts_soft_delete ON contacts IS
    'Hides soft-deleted contacts from SELECT queries';

COMMENT ON FUNCTION set_current_user_id(UUID) IS
    'Sets the current user context for RLS. Call at request start: SELECT set_current_user_id(user_id)';

COMMENT ON FUNCTION get_current_user_id() IS
    'Returns the current user UUID from session context';
