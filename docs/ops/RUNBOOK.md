# Operations Runbook

**Personal Network CRM - Operations Playbook**
**Version:** 1.0.0
**Last Updated:** November 30, 2025

This runbook provides operational procedures for the Personal Network CRM platform.

---

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Incident Response](#incident-response)
3. [Common Incidents](#common-incidents)
4. [Maintenance Windows](#maintenance-windows)
5. [Performance Tuning](#performance-tuning)
6. [Emergency Contacts](#emergency-contacts)

---

## Daily Operations

### Morning Health Check (09:00 UTC) - 10 minutes

**1. Check Service Status**

```bash
# All services running
pm2 list

# Expected output:
# pmcrm-api    │ online │ 0    │ 2.1s  │ 0    │ 234.5MB
# pmcrm-worker │ online │ 0    │ 2.1s  │ 0    │ 156.2MB
```

**2. Verify Database Connectivity**

```bash
npm run db:health

# Expected:
# ✓ Database connected
# ✓ Active connections: 12/100
# ✓ Cache hit ratio: 98.5%
```

**3. Check Error Rates (Sentry)**

Visit: [https://sentry.io/organizations/pmcrm/issues/](https://sentry.io/organizations/pmcrm/issues/)

- **Green**: < 10 errors/hour
- **Yellow**: 10-50 errors/hour (investigate)
- **Red**: > 50 errors/hour (incident)

**4. Monitor Dashboard Review**

Access: [https://grafana.personalnetworkcrm.com](https://grafana.personalnetworkcrm.com)

Check:
- [ ] API response time < 500ms (p95)
- [ ] Database query time < 200ms (p95)
- [ ] CPU usage < 70%
- [ ] Memory usage < 80%
- [ ] Disk usage < 75%

**5. Check Backup Status**

```bash
# Verify last backup
aws s3 ls s3://pmcrm-backups/db/ --recursive | tail -n 5

# Expected: Backup from last 24 hours
# db_backup_20251130_020000.sql.gz
```

**6. Review Failed Jobs (BullMQ)**

```bash
# Check failed jobs
redis-cli LLEN bull:email-queue:failed

# If > 10, investigate
npm run jobs:retry-failed
```

### Monitoring Dashboard Review - 5 minutes

**Access Prometheus/Grafana:**

```bash
# Prometheus
open http://localhost:9090

# Grafana
open https://grafana.personalnetworkcrm.com
```

**Key Metrics to Monitor:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| API Latency (p95) | < 500ms | Investigate if > 1s |
| Database Connections | < 80% of max | Scale if > 80% |
| Error Rate | < 1% | Investigate if > 2% |
| Memory Usage | < 80% | Restart if > 90% |
| Disk Usage | < 75% | Clean logs if > 85% |
| Active Users | Track trends | Report daily |

**Weekly Alert Review (Fridays):**

```bash
# Check alert history
curl -s "http://localhost:9090/api/v1/alerts" | jq '.data.alerts[] | {alertname, state}'

# Review false positives
# Tune thresholds if needed
```

### Backup Verification - Daily at 03:00 UTC

```bash
# Automated verification script
#!/bin/bash
LATEST_BACKUP=$(aws s3 ls s3://pmcrm-backups/db/ --recursive | sort | tail -n 1 | awk '{print $4}')
BACKUP_AGE=$(aws s3api head-object --bucket pmcrm-backups --key "$LATEST_BACKUP" --query 'LastModified' --output text)

# Check if backup is less than 24 hours old
if [[ $(date -d "$BACKUP_AGE" +%s) -lt $(date -d "24 hours ago" +%s) ]]; then
  echo "ALERT: Backup older than 24 hours!"
  # Send alert to Slack/PagerDuty
  curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"Backup verification failed!"}' \
    $SLACK_WEBHOOK_URL
fi
```

---

## Incident Response

### Incident Severity Classification

| Severity | Description | Examples | Response Time |
|----------|-------------|----------|---------------|
| **P0** | Complete outage | API down, database unavailable | 15 minutes |
| **P1** | Major degradation | Login failures, sync broken | 1 hour |
| **P2** | Partial degradation | Slow responses, some features down | 4 hours |
| **P3** | Minor issues | UI bugs, non-critical errors | 24 hours |

### Detection and Alerting

**Automated Alerts:**

1. **Sentry** - Application errors
2. **Prometheus** - Infrastructure metrics
3. **PagerDuty** - On-call rotation
4. **Slack** - Team notifications

**Alert Channels:**

```yaml
# Slack channels
#ops-alerts     - All alerts
#ops-critical   - P0/P1 only
#ops-incidents  - Active incidents

# PagerDuty
# P0/P1: Page on-call engineer
# P2/P3: Email notification
```

### Escalation Procedures

**Escalation Path:**

1. **Level 1**: On-call DevOps Engineer (First 30 minutes)
2. **Level 2**: Senior DevOps + Backend Lead (30-60 minutes)
3. **Level 3**: CTO + Engineering Manager (60+ minutes)
4. **Level 4**: CEO (Customer-facing outage > 2 hours)

**Escalation Contact:**

```bash
# View on-call schedule
pagerduty-cli oncall show

# Page on-call
pagerduty-cli incident trigger \
  --title "Database connection pool exhausted" \
  --severity high \
  --service pmcrm-production
```

### Communication Templates

**Internal Communication (Slack):**

```
🚨 INCIDENT DETECTED - P[0-3]

Title: [Brief description]
Impact: [User-facing impact]
Services Affected: [API, Dashboard, Sync]
Started: [Timestamp]
Status: Investigating/Mitigating/Resolved

Updates:
- [Timestamp] Initial detection
- [Timestamp] Root cause identified
- [Timestamp] Fix deployed
- [Timestamp] Incident resolved

Next Steps:
- [Action items]

Incident Commander: @[Name]
```

**External Communication (Status Page):**

```markdown
### [INVESTIGATING] API Latency Issues

We are currently investigating reports of increased API latency.

**Impact:** Users may experience slow page loads.
**Started:** 2025-11-30 10:15 UTC
**Status:** Investigating

Updates will be posted every 15 minutes.

---

### [UPDATE] API Latency Issues

We have identified the root cause and are deploying a fix.

**Update:** 2025-11-30 10:45 UTC
**ETA:** 15 minutes

---

### [RESOLVED] API Latency Issues

The issue has been resolved. All systems are operating normally.

**Resolved:** 2025-11-30 11:00 UTC
**Duration:** 45 minutes
**Root Cause:** Database connection pool exhaustion
**Prevention:** Increased connection pool size, added monitoring
```

---

## Common Incidents

### Incident: Database Connection Issues

**Symptoms:**
- 500 errors with "connection pool exhausted"
- Slow API responses
- Health check failures

**Diagnosis:**

```bash
# Check active connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Check connection pool config
cat .env | grep DATABASE_POOL
```

**Resolution:**

```bash
# Option 1: Increase connection pool
# Edit .env
DATABASE_POOL_MAX=20  # Increase from 10

# Restart API
pm2 restart pmcrm-api

# Option 2: Kill long-running queries
sudo -u postgres psql -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND state_change < NOW() - INTERVAL '5 minutes';
"
```

**Prevention:**
- Monitor connection pool usage
- Implement connection timeout
- Add connection pool alerts

### Incident: OAuth Failures

**Symptoms:**
- Users can't sign in with Google/Microsoft
- "OAuth error" messages
- Increased login failures

**Diagnosis:**

```bash
# Check OAuth credentials
npx ts-node scripts/verify-oauth.ts

# Test Google OAuth token
curl "https://oauth2.googleapis.com/tokeninfo?access_token=$TOKEN"

# Check audit logs for OAuth errors
sudo -u postgres psql pmcrm -c "
SELECT * FROM \"AuditLog\"
WHERE action = 'LOGIN_FAILED'
  AND details LIKE '%oauth%'
ORDER BY \"createdAt\" DESC
LIMIT 10;
"
```

**Resolution:**

```bash
# Option 1: Refresh OAuth credentials
# Update .env with new credentials
# Restart API
pm2 restart pmcrm-api

# Option 2: Clear OAuth cache
redis-cli KEYS "oauth:*" | xargs redis-cli DEL

# Option 3: Verify redirect URIs
# Check Google Cloud Console / Azure Portal
# Ensure callback URLs are correct
```

**Prevention:**
- Monitor OAuth token expiration
- Set up credential rotation alerts
- Test OAuth flow in staging regularly

### Incident: API Rate Limits Exceeded

**Symptoms:**
- 429 "Too Many Requests" errors
- Users report "slow down" messages
- Spike in rate limit alerts

**Diagnosis:**

```bash
# Check rate limit hits
redis-cli KEYS "rl:*" | wc -l

# Find top offenders
redis-cli --scan --pattern "rl:user:*" | while read key; do
  count=$(redis-cli GET "$key")
  echo "$key: $count"
done | sort -t: -k3 -nr | head -10
```

**Resolution:**

```bash
# Option 1: Clear rate limit for specific user
redis-cli DEL "rl:user:<user-id>"

# Option 2: Temporarily increase rate limits
# Edit .env
RATE_LIMIT_MAX_REQUESTS=200  # Increase from 100

# Restart API
pm2 restart pmcrm-api

# Option 3: Block abusive IP
redis-cli SET "blocked:ip:1.2.3.4" "1" EX 3600
```

**Prevention:**
- Implement gradual backoff
- Add per-endpoint rate limits
- Monitor unusual traffic patterns

### Incident: High Memory Usage

**Symptoms:**
- API process crashes
- OOM killer messages in logs
- Slow performance

**Diagnosis:**

```bash
# Check memory usage
pm2 monit
free -h

# Check memory leaks
node --inspect dist/main.js
# Use Chrome DevTools to profile

# Check process memory
ps aux | grep node | sort -k4 -nr
```

**Resolution:**

```bash
# Option 1: Restart service
pm2 restart pmcrm-api

# Option 2: Increase memory limit
pm2 delete pmcrm-api
pm2 start dist/main.js \
  --name pmcrm-api \
  --max-memory-restart 2G \
  --node-args="--max-old-space-size=4096"

# Option 3: Clear caches
redis-cli FLUSHDB
```

**Prevention:**
- Monitor memory trends
- Implement garbage collection tuning
- Add memory leak detection
- Set up auto-restart on memory threshold

### Incident: Slow Queries

**Symptoms:**
- API timeout errors
- Slow dashboard loading
- Database CPU at 100%

**Diagnosis:**

```sql
-- Find slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE 'pg_%';
```

**Resolution:**

```sql
-- Create missing indexes
CREATE INDEX CONCURRENTLY idx_contact_workspace_id ON "Contact"("workspaceId");
CREATE INDEX CONCURRENTLY idx_contact_email ON "Contact"(email);

-- Vacuum and analyze
VACUUM ANALYZE "Contact";
VACUUM ANALYZE "User";

-- Kill long-running queries
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active'
  AND query_start < NOW() - INTERVAL '5 minutes';
```

**Prevention:**
- Regular VACUUM ANALYZE
- Monitor query performance
- Add missing indexes
- Implement query timeout

---

## Maintenance Windows

### Scheduling Maintenance

**Preferred Windows:**
- **Primary**: Sunday 02:00-04:00 UTC (Lowest traffic)
- **Secondary**: Wednesday 02:00-04:00 UTC

**Maintenance Types:**

| Type | Frequency | Duration | Downtime |
|------|-----------|----------|----------|
| Security patches | Weekly | 15 min | 0 min (rolling) |
| Minor updates | Bi-weekly | 30 min | 0 min (rolling) |
| Major updates | Monthly | 2 hours | 15 min |
| Database maintenance | Quarterly | 4 hours | 30 min |

### Communication Plan

**Timeline:**

- **T-7 days**: Announce on status page, email customers
- **T-3 days**: Reminder email to all users
- **T-1 day**: In-app banner notification
- **T-2 hours**: Status page update
- **T-0**: Begin maintenance, update status page
- **T+completion**: Verify, update status page

**Communication Template:**

```markdown
### Scheduled Maintenance - [Date] [Time] UTC

We will be performing scheduled maintenance to improve performance and security.

**When:** Sunday, December 1, 2025 at 02:00 UTC
**Duration:** Approximately 2 hours
**Impact:** Brief service interruption (15 minutes)

**What we're doing:**
- Database performance optimization
- Security patches
- Infrastructure upgrades

**What you need to do:**
- Save your work before 02:00 UTC
- Plan for possible brief downtime

We apologize for any inconvenience. Questions? Contact support@personalnetworkcrm.com
```

### Rollback Procedures

**Pre-Deployment Checklist:**

```bash
# 1. Create database backup
npm run db:backup

# 2. Tag current release
git tag -a v1.0.0-pre-maintenance -m "Pre-maintenance backup"
git push origin v1.0.0-pre-maintenance

# 3. Document current state
pm2 save
pm2 list > /tmp/pm2-state-backup.txt
```

**Rollback Steps:**

```bash
# 1. Stop new deployment
pm2 stop pmcrm-api

# 2. Checkout previous version
git checkout v1.0.0-pre-maintenance

# 3. Restore dependencies
npm ci

# 4. Rollback database (if needed)
npm run db:migrate:rollback

# 5. Restart service
pm2 restart pmcrm-api

# 6. Verify
curl https://api.personalnetworkcrm.com/health
```

**Rollback Decision Criteria:**

- Error rate > 5% for 10 minutes
- Critical functionality broken
- Database corruption detected
- Security vulnerability introduced

---

## Performance Tuning

### Database Optimization

**Query Performance:**

```sql
-- Enable query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Analyze slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  stddev_time
FROM pg_stat_statements
WHERE mean_time > 100  -- Queries slower than 100ms
ORDER BY mean_time DESC
LIMIT 20;

-- Create indexes for slow queries
-- Example: Contact search by email
CREATE INDEX CONCURRENTLY idx_contact_email ON "Contact"(email);
CREATE INDEX CONCURRENTLY idx_contact_workspace_email ON "Contact"("workspaceId", email);

-- Partial index for active users
CREATE INDEX CONCURRENTLY idx_user_active ON "User"("isActive") WHERE "isActive" = true;
```

**Connection Pooling:**

```javascript
// Optimal pool size calculation
// connections = ((core_count * 2) + effective_spindle_count)
// For 4 cores, 1 SSD: (4 * 2) + 1 = 9

// Update .env
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_POOL_IDLE_TIMEOUT=10000
```

**Vacuuming Strategy:**

```sql
-- Analyze table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Regular maintenance
VACUUM ANALYZE "Contact";
VACUUM ANALYZE "User";
VACUUM ANALYZE "AuditLog";

-- Full vacuum (during maintenance window)
VACUUM FULL "AuditLog";
```

### Cache Tuning

**Redis Configuration:**

```bash
# Edit redis.conf
maxmemory 4gb
maxmemory-policy allkeys-lru  # Evict least recently used keys

# Persistence
save 900 1      # Save if 1 key changed in 15 min
save 300 10     # Save if 10 keys changed in 5 min
save 60 10000   # Save if 10000 keys changed in 1 min

appendonly yes  # Enable AOF
appendfsync everysec

# Restart Redis
sudo systemctl restart redis
```

**Application Caching:**

```typescript
// Cache frequently accessed data
// User profile: 1 hour
// Contact list: 5 minutes
// AI recommendations: 30 minutes

// Example cache key pattern
user:${userId}:profile         // TTL: 3600
workspace:${workspaceId}:stats  // TTL: 300
ai:recommendations:${userId}    // TTL: 1800
```

### Query Optimization

**Best Practices:**

```typescript
// ❌ Bad: N+1 query problem
const users = await prisma.user.findMany();
for (const user of users) {
  const contacts = await prisma.contact.findMany({
    where: { userId: user.id }
  });
}

// ✅ Good: Use include
const users = await prisma.user.findMany({
  include: {
    contacts: true
  }
});

// ✅ Better: Use select to limit fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    contacts: {
      select: {
        id: true,
        name: true
      }
    }
  }
});
```

### Scaling Procedures

**Horizontal Scaling (API):**

```bash
# Add more API instances
pm2 scale pmcrm-api +2  # Add 2 more instances

# Or use cluster mode
pm2 start dist/main.js \
  --name pmcrm-api \
  -i max  # Use all CPU cores
```

**Vertical Scaling (Database):**

```bash
# Increase PostgreSQL memory
# Edit postgresql.conf
shared_buffers = 4GB  # 25% of total RAM
effective_cache_size = 12GB  # 75% of total RAM
work_mem = 128MB
maintenance_work_mem = 1GB

# Restart PostgreSQL
sudo systemctl restart postgresql
```

**Read Replicas:**

```bash
# Set up read replica
# Update .env
DATABASE_READ_REPLICA_URL="postgresql://user:pass@replica-host:5432/pmcrm"

# Route read queries to replica
// In code
const contacts = await prisma.$queryRaw`SELECT * FROM "Contact"`;  // Uses read replica
```

---

## Emergency Contacts

### On-Call Rotation

| Role | Primary | Backup |
|------|---------|--------|
| DevOps Engineer | John Doe (+1-555-0100) | Jane Smith (+1-555-0101) |
| Backend Lead | Bob Johnson (+1-555-0102) | Alice Williams (+1-555-0103) |
| Database Admin | Charlie Brown (+1-555-0104) | Diana Prince (+1-555-0105) |
| Security Lead | Eve Davis (+1-555-0106) | Frank Miller (+1-555-0107) |

### External Contacts

| Service | Contact | Support Level |
|---------|---------|---------------|
| AWS Support | +1-888-AMAZON | Enterprise 24/7 |
| Sentry | support@sentry.io | Email |
| Railway | support@railway.app | Email + Discord |
| Vercel | support@vercel.com | Email |
| PagerDuty | support@pagerduty.com | 24/7 |

### Escalation Tree

```
Incident Detected
    ↓
On-Call DevOps Engineer (15 min)
    ↓ (if unresolved after 30 min)
Senior DevOps + Backend Lead
    ↓ (if unresolved after 1 hour)
CTO + Engineering Manager
    ↓ (if customer-facing > 2 hours)
CEO + Exec Team
```

---

## Appendix

### Useful Commands

```bash
# Service management
pm2 list
pm2 restart pmcrm-api
pm2 logs pmcrm-api
pm2 monit

# Database
npm run db:health
npm run db:backup
sudo -u postgres psql pmcrm

# Redis
redis-cli INFO
redis-cli KEYS "*"
redis-cli FLUSHDB

# Monitoring
curl http://localhost:9090/metrics
curl https://api.personalnetworkcrm.com/health

# Logs
tail -f ~/.pm2/logs/pmcrm-api-out.log
tail -f /var/log/postgresql/postgresql-16-main.log
```

### Runbook Updates

This runbook should be reviewed and updated:
- After each incident (add new procedures)
- Monthly (verify contact information)
- Quarterly (review and improve procedures)

**Last Review:** November 30, 2025
**Next Review:** February 28, 2026
**Owner:** DevOps Team (devops@personalnetworkcrm.com)

---

**Document Version:** 1.0.0

For questions or suggestions, contact: devops@personalnetworkcrm.com
