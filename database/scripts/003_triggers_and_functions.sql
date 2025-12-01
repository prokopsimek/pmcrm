-- ============================================================================
-- Database Triggers and Functions
-- Personal Network CRM
-- ============================================================================
--
-- This script contains business logic triggers and utility functions
-- ============================================================================

-- ============================================================================
-- AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_employments_updated_at
    BEFORE UPDATE ON contact_employments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interactions_updated_at
    BEFORE UPDATE ON interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at
    BEFORE UPDATE ON reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_insights_updated_at
    BEFORE UPDATE ON ai_insights
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tags_updated_at
    BEFORE UPDATE ON tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RELATIONSHIP STRENGTH CALCULATION
-- ============================================================================

-- Function to calculate relationship strength based on interactions
CREATE OR REPLACE FUNCTION calculate_relationship_strength(
    p_contact_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_user_id UUID;
    v_interaction_count INTEGER;
    v_days_since_last_contact INTEGER;
    v_interaction_score DECIMAL;
    v_recency_score DECIMAL;
    v_final_score INTEGER;
BEGIN
    -- Get user_id for the contact
    SELECT user_id INTO v_user_id
    FROM contacts
    WHERE id = p_contact_id;

    -- Count interactions in last 90 days
    SELECT COUNT(*)
    INTO v_interaction_count
    FROM interactions i
    JOIN interaction_participants ip ON i.id = ip.interaction_id
    WHERE ip.contact_id = p_contact_id
    AND i.user_id = v_user_id
    AND i.occurred_at > NOW() - INTERVAL '90 days';

    -- Calculate days since last contact
    SELECT EXTRACT(DAY FROM NOW() - MAX(i.occurred_at))
    INTO v_days_since_last_contact
    FROM interactions i
    JOIN interaction_participants ip ON i.id = ip.interaction_id
    WHERE ip.contact_id = p_contact_id
    AND i.user_id = v_user_id;

    -- Handle NULL (no interactions)
    v_days_since_last_contact := COALESCE(v_days_since_last_contact, 365);

    -- Calculate interaction score (0-5)
    v_interaction_score := LEAST(v_interaction_count / 5.0, 5.0);

    -- Calculate recency score with exponential decay (0-5)
    v_recency_score := 5.0 * EXP(-v_days_since_last_contact / 30.0);

    -- Final score (1-10)
    v_final_score := GREATEST(1, LEAST(10, ROUND((v_interaction_score + v_recency_score)::NUMERIC)));

    RETURN v_final_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTOMATIC RELATIONSHIP STRENGTH UPDATE
-- ============================================================================

-- Update relationship strength when new interaction is added
CREATE OR REPLACE FUNCTION update_contact_relationship_strength()
RETURNS TRIGGER AS $$
DECLARE
    v_contact_id UUID;
    v_new_strength INTEGER;
BEGIN
    -- Loop through all participants of the interaction
    FOR v_contact_id IN
        SELECT contact_id
        FROM interaction_participants
        WHERE interaction_id = NEW.id
    LOOP
        -- Calculate new strength
        v_new_strength := calculate_relationship_strength(v_contact_id);

        -- Update contact
        UPDATE contacts
        SET
            relationship_strength = v_new_strength,
            last_contact_date = NEW.occurred_at::DATE
        WHERE id = v_contact_id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_relationship_on_interaction
    AFTER INSERT ON interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_relationship_strength();

-- ============================================================================
-- AUDIT LOGGING TRIGGERS
-- ============================================================================

-- Generic audit log function
CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_entity_type TEXT;
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    -- Get current user from context
    v_user_id := current_setting('app.current_user_id', true)::UUID;
    v_entity_type := TG_TABLE_NAME;

    -- Build old and new values JSON
    IF TG_OP = 'UPDATE' THEN
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_old_values := to_jsonb(OLD);
    ELSIF TG_OP = 'INSERT' THEN
        v_new_values := to_jsonb(NEW);
    END IF;

    -- Insert audit log
    INSERT INTO audit_logs (
        user_id,
        event_type,
        entity_type,
        entity_id,
        action,
        old_values,
        new_values
    ) VALUES (
        v_user_id,
        TG_TABLE_NAME || '_' || TG_OP,
        v_entity_type,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        v_old_values,
        v_new_values
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply audit logging to sensitive tables
CREATE TRIGGER audit_contacts_changes
    AFTER INSERT OR UPDATE OR DELETE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_users_changes
    AFTER UPDATE OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_consent_changes
    AFTER INSERT OR UPDATE ON consent_records
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_changes();

-- ============================================================================
-- SOFT DELETE HELPERS
-- ============================================================================

-- Function to soft delete a contact
CREATE OR REPLACE FUNCTION soft_delete_contact(
    p_contact_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE contacts
    SET deleted_at = NOW()
    WHERE id = p_contact_id
    AND deleted_at IS NULL;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to restore soft deleted contact
CREATE OR REPLACE FUNCTION restore_contact(
    p_contact_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE contacts
    SET deleted_at = NULL
    WHERE id = p_contact_id
    AND deleted_at IS NOT NULL;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to permanently delete old soft-deleted records (GDPR compliance)
CREATE OR REPLACE FUNCTION purge_deleted_contacts(
    p_days_old INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Hard delete contacts that were soft-deleted more than p_days_old days ago
    WITH deleted AS (
        DELETE FROM contacts
        WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - (p_days_old || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- NEXT CONTACT DATE CALCULATION
-- ============================================================================

-- Function to calculate next suggested contact date
CREATE OR REPLACE FUNCTION calculate_next_contact_date(
    p_contact_id UUID
)
RETURNS DATE AS $$
DECLARE
    v_last_contact_date DATE;
    v_contact_frequency_days INTEGER;
    v_next_date DATE;
BEGIN
    SELECT last_contact_date, contact_frequency_days
    INTO v_last_contact_date, v_contact_frequency_days
    FROM contacts
    WHERE id = p_contact_id;

    -- If no frequency set, default to 30 days
    v_contact_frequency_days := COALESCE(v_contact_frequency_days, 30);

    -- If no last contact, use creation date
    IF v_last_contact_date IS NULL THEN
        SELECT created_at::DATE INTO v_last_contact_date
        FROM contacts
        WHERE id = p_contact_id;
    END IF;

    -- Calculate next date
    v_next_date := v_last_contact_date + (v_contact_frequency_days || ' days')::INTERVAL;

    RETURN v_next_date;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update next_contact_date automatically
CREATE OR REPLACE FUNCTION update_next_contact_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_contact_date IS NOT NULL OR NEW.contact_frequency_days IS NOT NULL THEN
        NEW.next_contact_date := calculate_next_contact_date(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contact_next_date
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    WHEN (
        NEW.last_contact_date IS DISTINCT FROM OLD.last_contact_date
        OR NEW.contact_frequency_days IS DISTINCT FROM OLD.contact_frequency_days
    )
    EXECUTE FUNCTION update_next_contact_date();

-- ============================================================================
-- EMPLOYMENT HISTORY MANAGEMENT
-- ============================================================================

-- Function to update is_current flag when new employment added
CREATE OR REPLACE FUNCTION update_employment_current_flag()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a current position, set all others to not current
    IF NEW.is_current = true THEN
        UPDATE contact_employments
        SET is_current = false
        WHERE contact_id = NEW.contact_id
        AND id != NEW.id
        AND is_current = true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER employment_current_flag
    BEFORE INSERT OR UPDATE ON contact_employments
    FOR EACH ROW
    WHEN (NEW.is_current = true)
    EXECUTE FUNCTION update_employment_current_flag();

-- ============================================================================
-- INTEGRATION TOKEN ENCRYPTION (Placeholder)
-- ============================================================================

-- Note: In production, use pgcrypto for actual encryption
-- This is a placeholder showing where encryption should happen

CREATE OR REPLACE FUNCTION encrypt_integration_tokens()
RETURNS TRIGGER AS $$
BEGIN
    -- TODO: Implement proper encryption using pgcrypto
    -- NEW.access_token := pgp_sym_encrypt(NEW.access_token, current_setting('app.encryption_key'));
    -- NEW.refresh_token := pgp_sym_encrypt(NEW.refresh_token, current_setting('app.encryption_key'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CREATE TRIGGER encrypt_integration_tokens_trigger
--     BEFORE INSERT OR UPDATE ON integrations
--     FOR EACH ROW
--     WHEN (NEW.access_token IS NOT NULL OR NEW.refresh_token IS NOT NULL)
--     EXECUTE FUNCTION encrypt_integration_tokens();

-- ============================================================================
-- ANALYTICS FUNCTIONS
-- ============================================================================

-- Get interaction statistics for a user
CREATE OR REPLACE FUNCTION get_interaction_stats(
    p_user_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    interaction_type VARCHAR,
    count BIGINT,
    avg_per_day NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.interaction_type,
        COUNT(*) as count,
        ROUND(COUNT(*)::NUMERIC / p_days, 2) as avg_per_day
    FROM interactions i
    WHERE i.user_id = p_user_id
    AND i.occurred_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY i.interaction_type
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Get top contacts by interaction count
CREATE OR REPLACE FUNCTION get_top_contacts(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    contact_id UUID,
    full_name TEXT,
    interaction_count BIGINT,
    last_interaction DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.first_name || ' ' || COALESCE(c.last_name, ''),
        COUNT(ip.interaction_id),
        MAX(i.occurred_at)::DATE
    FROM contacts c
    JOIN interaction_participants ip ON c.id = ip.contact_id
    JOIN interactions i ON ip.interaction_id = i.id
    WHERE c.user_id = p_user_id
    AND c.deleted_at IS NULL
    GROUP BY c.id, c.first_name, c.last_name
    ORDER BY COUNT(ip.interaction_id) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION calculate_relationship_strength(UUID) IS
    'Calculates relationship strength score (1-10) based on interaction frequency and recency';

COMMENT ON FUNCTION soft_delete_contact(UUID) IS
    'Soft deletes a contact by setting deleted_at timestamp';

COMMENT ON FUNCTION purge_deleted_contacts(INTEGER) IS
    'Permanently deletes contacts that were soft-deleted more than N days ago (GDPR compliance)';

COMMENT ON FUNCTION get_interaction_stats(UUID, INTEGER) IS
    'Returns interaction statistics for a user over specified period';
