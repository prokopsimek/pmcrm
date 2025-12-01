-- =====================================================
-- Personal Network CRM - Database Optimization Scripts
-- =====================================================
-- This file contains indexing strategies, query optimization,
-- and performance monitoring for PostgreSQL 16+
-- =====================================================

-- =====================================================
-- 1. INDEXING STRATEGY
-- =====================================================

-- CONTACTS TABLE INDEXES
-- Primary access patterns: user lookups, search, relationship scoring

-- Partial index for active contacts (excludes soft-deleted)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_user_active
ON contacts(user_id, id)
WHERE deleted_at IS NULL;

-- Full-text search index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_search
ON contacts USING GIN(search_vector);

-- Update search vector trigger
CREATE OR REPLACE FUNCTION contacts_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.first_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.last_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.email, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.enrichment_data->>'company', '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_search_vector_trigger ON contacts;
CREATE TRIGGER contacts_search_vector_trigger
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION contacts_search_vector_update();

-- Relationship strength lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_relationship_strength
ON contacts(user_id, relationship_strength DESC)
WHERE deleted_at IS NULL;

-- Last contact date for stale relationship detection
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_last_contact
ON contacts(user_id, last_contact_date DESC NULLS LAST)
WHERE deleted_at IS NULL;

-- Email lookup (unique constraint)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_email_unique
ON contacts(user_id, LOWER(email))
WHERE deleted_at IS NULL AND email IS NOT NULL;

-- JSONB index for enrichment data queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_enrichment
ON contacts USING GIN(enrichment_data);

-- INTERACTIONS TABLE INDEXES
-- Primary access patterns: timeline queries, participant lookups, aggregations

-- User timeline with sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interactions_user_timeline
ON interactions(user_id, occurred_at DESC);

-- Interaction type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interactions_type
ON interactions(user_id, interaction_type, occurred_at DESC);

-- External source deduplication
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_interactions_external_id
ON interactions(external_source, external_id)
WHERE external_id IS NOT NULL;

-- Sentiment analysis queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interactions_sentiment
ON interactions(user_id, sentiment_score DESC NULLS LAST)
WHERE sentiment_score IS NOT NULL;

-- INTERACTION_PARTICIPANTS TABLE INDEXES
-- Primary access patterns: contact interaction history

-- Contact's interaction history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interaction_participants_contact
ON interaction_participants(contact_id, interaction_id);

-- Reverse lookup for interaction participants
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interaction_participants_interaction
ON interaction_participants(interaction_id);

-- ORGANIZATIONS TABLE INDEXES
-- Primary access patterns: user lookups, domain searches

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_user
ON organizations(user_id);

-- Domain-based company matching
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_domain
ON organizations(user_id, LOWER(domain))
WHERE domain IS NOT NULL;

-- Industry filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_industry
ON organizations(user_id, industry)
WHERE industry IS NOT NULL;

-- CONTACT_EMPLOYMENTS TABLE INDEXES
-- Primary access patterns: current employment, job history

-- Current employment lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_employments_current
ON contact_employments(contact_id, organization_id)
WHERE is_current = true;

-- Organization's employees
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_employments_org
ON contact_employments(organization_id, contact_id)
WHERE is_current = true;

-- Date range queries for employment history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_employments_dates
ON contact_employments(contact_id, start_date DESC, end_date DESC);

-- REMINDERS TABLE INDEXES
-- Primary access patterns: pending reminders, due date sorting

-- Pending reminders due soon
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reminders_pending_due
ON reminders(user_id, due_at ASC)
WHERE status = 'pending';

-- Contact-specific reminders
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reminders_contact
ON reminders(contact_id, due_at DESC)
WHERE contact_id IS NOT NULL;

-- AI_INSIGHTS TABLE INDEXES
-- Primary access patterns: active insights, priority sorting

-- Active insights by priority
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_insights_active
ON ai_insights(user_id, priority DESC, created_at DESC)
WHERE status = 'pending' AND (expires_at IS NULL OR expires_at > NOW());

-- Contact-specific insights
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_insights_contact
ON ai_insights(contact_id, created_at DESC)
WHERE contact_id IS NOT NULL;

-- Insight type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_insights_type
ON ai_insights(user_id, insight_type, created_at DESC);

-- TAGS TABLE INDEXES
-- Primary access patterns: user's tags

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_user_name
ON tags(user_id, LOWER(name));

-- =====================================================
-- 2. QUERY OPTIMIZATION - COMMON QUERIES
-- =====================================================

-- Materialized view for relationship scoring aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_contact_interaction_stats AS
SELECT
  c.id AS contact_id,
  c.user_id,
  COUNT(DISTINCT ip.interaction_id) AS total_interactions,
  MAX(i.occurred_at) AS last_interaction_at,
  AVG(i.sentiment_score) AS avg_sentiment,
  COUNT(DISTINCT CASE WHEN i.interaction_type = 'email' THEN i.id END) AS email_count,
  COUNT(DISTINCT CASE WHEN i.interaction_type = 'meeting' THEN i.id END) AS meeting_count,
  COUNT(DISTINCT CASE WHEN i.interaction_type = 'call' THEN i.id END) AS call_count
FROM contacts c
LEFT JOIN interaction_participants ip ON c.id = ip.contact_id
LEFT JOIN interactions i ON ip.interaction_id = i.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_contact_stats_contact
ON mv_contact_interaction_stats(contact_id);

CREATE INDEX IF NOT EXISTS idx_mv_contact_stats_user
ON mv_contact_interaction_stats(user_id, last_interaction_at DESC NULLS LAST);

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_contact_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_contact_interaction_stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. N+1 QUERY PREVENTION
-- =====================================================

-- Example: Fetch contacts with their latest interaction
-- BAD: This causes N+1 queries
-- SELECT * FROM contacts WHERE user_id = ?;
-- For each contact: SELECT * FROM interactions WHERE contact_id = ? ORDER BY occurred_at DESC LIMIT 1;

-- GOOD: Use window functions or CTEs
CREATE OR REPLACE FUNCTION get_contacts_with_last_interaction(p_user_id UUID)
RETURNS TABLE (
  contact_id UUID,
  contact_name TEXT,
  last_interaction_type VARCHAR,
  last_interaction_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_interactions AS (
    SELECT
      ip.contact_id,
      i.interaction_type,
      i.occurred_at,
      ROW_NUMBER() OVER (PARTITION BY ip.contact_id ORDER BY i.occurred_at DESC) AS rn
    FROM interaction_participants ip
    JOIN interactions i ON ip.interaction_id = i.id
    WHERE i.user_id = p_user_id
  )
  SELECT
    c.id,
    CONCAT(c.first_name, ' ', c.last_name),
    ri.interaction_type,
    ri.occurred_at
  FROM contacts c
  LEFT JOIN ranked_interactions ri ON c.id = ri.contact_id AND ri.rn = 1
  WHERE c.user_id = p_user_id AND c.deleted_at IS NULL
  ORDER BY ri.occurred_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. PARTITIONING STRATEGY
-- =====================================================

-- For large-scale deployments, partition interactions by time
-- This example shows monthly partitioning for interactions table

-- Note: Run this on new installations. For existing data, use pg_partman

CREATE TABLE IF NOT EXISTS interactions_partitioned (
  LIKE interactions INCLUDING ALL
) PARTITION BY RANGE (occurred_at);

-- Create partitions for current and future months
-- This should be automated with a cron job or pg_partman

CREATE TABLE IF NOT EXISTS interactions_y2025_m01
PARTITION OF interactions_partitioned
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS interactions_y2025_m02
PARTITION OF interactions_partitioned
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Index on each partition
CREATE INDEX IF NOT EXISTS idx_interactions_y2025_m01_user
ON interactions_y2025_m01(user_id, occurred_at DESC);

-- =====================================================
-- 5. QUERY PERFORMANCE MONITORING
-- =====================================================

-- Enable pg_stat_statements for query analysis
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries (requires pg_stat_statements)
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time,
  rows
FROM pg_stat_statements
WHERE mean_exec_time > 100 -- queries slower than 100ms
ORDER BY mean_exec_time DESC
LIMIT 50;

-- View most frequent queries
CREATE OR REPLACE VIEW v_frequent_queries AS
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  min_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 50;

-- Index usage statistics
CREATE OR REPLACE VIEW v_index_usage AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- Unused indexes (candidates for removal)
CREATE OR REPLACE VIEW v_unused_indexes AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Table bloat estimation
CREATE OR REPLACE VIEW v_table_bloat AS
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  n_dead_tup,
  n_live_tup,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_percent
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY n_dead_tup DESC;

-- =====================================================
-- 6. VACUUM AND MAINTENANCE
-- =====================================================

-- Analyze all tables to update statistics
ANALYZE;

-- Vacuum to reclaim space (run during off-peak hours)
-- VACUUM ANALYZE;

-- Auto-vacuum settings (add to postgresql.conf)
-- autovacuum = on
-- autovacuum_max_workers = 3
-- autovacuum_naptime = 1min
-- autovacuum_vacuum_scale_factor = 0.1
-- autovacuum_analyze_scale_factor = 0.05

-- =====================================================
-- 7. CONNECTION POOLING OPTIMIZATION
-- =====================================================

-- Recommended PostgreSQL settings for connection pooling
-- (Add to postgresql.conf or managed service settings)

-- max_connections = 200
-- shared_buffers = 4GB  -- 25% of RAM
-- effective_cache_size = 12GB  -- 75% of RAM
-- work_mem = 16MB
-- maintenance_work_mem = 512MB
-- random_page_cost = 1.1  -- For SSD storage
-- effective_io_concurrency = 200
-- max_worker_processes = 8
-- max_parallel_workers_per_gather = 4
-- max_parallel_workers = 8

-- =====================================================
-- 8. ROW-LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy for contacts
DROP POLICY IF EXISTS tenant_isolation_contacts ON contacts;
CREATE POLICY tenant_isolation_contacts ON contacts
  USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- Tenant isolation policy for interactions
DROP POLICY IF EXISTS tenant_isolation_interactions ON interactions;
CREATE POLICY tenant_isolation_interactions ON interactions
  USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- Tenant isolation policy for reminders
DROP POLICY IF EXISTS tenant_isolation_reminders ON reminders;
CREATE POLICY tenant_isolation_reminders ON reminders
  USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- Tenant isolation policy for ai_insights
DROP POLICY IF EXISTS tenant_isolation_ai_insights ON ai_insights;
CREATE POLICY tenant_isolation_ai_insights ON ai_insights
  USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- Tenant isolation policy for organizations
DROP POLICY IF EXISTS tenant_isolation_organizations ON organizations;
CREATE POLICY tenant_isolation_organizations ON organizations
  USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- =====================================================
-- 9. PERFORMANCE TESTING QUERIES
-- =====================================================

-- Test query performance for common operations

-- 1. Contact search (should use idx_contacts_search)
EXPLAIN ANALYZE
SELECT id, first_name, last_name, email
FROM contacts
WHERE search_vector @@ to_tsquery('english', 'john & smith')
  AND user_id = '00000000-0000-0000-0000-000000000000'
  AND deleted_at IS NULL
LIMIT 20;

-- 2. Stale contacts (should use idx_contacts_last_contact)
EXPLAIN ANALYZE
SELECT id, first_name, last_name, last_contact_date
FROM contacts
WHERE user_id = '00000000-0000-0000-0000-000000000000'
  AND deleted_at IS NULL
  AND (last_contact_date < NOW() - INTERVAL '30 days' OR last_contact_date IS NULL)
ORDER BY last_contact_date DESC NULLS LAST
LIMIT 20;

-- 3. Recent interactions timeline (should use idx_interactions_user_timeline)
EXPLAIN ANALYZE
SELECT i.id, i.interaction_type, i.occurred_at, i.subject
FROM interactions i
WHERE i.user_id = '00000000-0000-0000-0000-000000000000'
ORDER BY i.occurred_at DESC
LIMIT 50;

-- 4. Contact with interaction count (should use indexes efficiently)
EXPLAIN ANALYZE
SELECT
  c.id,
  c.first_name,
  c.last_name,
  COUNT(DISTINCT ip.interaction_id) AS interaction_count
FROM contacts c
LEFT JOIN interaction_participants ip ON c.id = ip.contact_id
WHERE c.user_id = '00000000-0000-0000-0000-000000000000'
  AND c.deleted_at IS NULL
GROUP BY c.id
ORDER BY interaction_count DESC
LIMIT 20;

-- =====================================================
-- 10. MONITORING FUNCTIONS
-- =====================================================

-- Function to get database health metrics
CREATE OR REPLACE FUNCTION get_database_health()
RETURNS TABLE (
  metric VARCHAR,
  value TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'database_size'::VARCHAR, pg_size_pretty(pg_database_size(current_database()))
  UNION ALL
  SELECT 'active_connections', COUNT(*)::TEXT FROM pg_stat_activity WHERE state = 'active'
  UNION ALL
  SELECT 'idle_connections', COUNT(*)::TEXT FROM pg_stat_activity WHERE state = 'idle'
  UNION ALL
  SELECT 'cache_hit_ratio', ROUND(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2)::TEXT || '%'
  FROM pg_stat_database WHERE datname = current_database();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- END OF OPTIMIZATION SCRIPTS
-- =====================================================
