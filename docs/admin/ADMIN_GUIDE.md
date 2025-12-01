# Administrator Guide

**Personal Network CRM - Version 1.0.0**
**For System Administrators and DevOps Teams**

---

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [User Management](#user-management)
3. [Workspace Management](#workspace-management)
4. [Security](#security)
5. [Monitoring](#monitoring)
6. [Backup & Recovery](#backup--recovery)
7. [Troubleshooting](#troubleshooting)

---

## Installation & Setup

### System Requirements

**Minimum Requirements:**
- **CPU**: 2 cores (4 cores recommended)
- **RAM**: 4GB (8GB recommended)
- **Storage**: 20GB SSD (50GB recommended)
- **OS**: Linux (Ubuntu 22.04 LTS, Debian 11+, or CentOS 8+)
- **Network**: 1Gbps network interface

**Production Requirements:**
- **CPU**: 4+ cores
- **RAM**: 16GB+
- **Storage**: 100GB+ SSD with IOPS 3000+
- **OS**: Linux (Ubuntu 22.04 LTS recommended)
- **Network**: 10Gbps network interface
- **Load Balancer**: Nginx or AWS ALB

### Database Requirements

**PostgreSQL 16+**
- pgvector extension 0.7.0+
- Connection pooling (PgBouncer or Supabase Pooler)
- Minimum: 2GB RAM, 20GB storage
- Production: 8GB+ RAM, 100GB+ storage
- IOPS: 3000+ for production workloads

**Redis 7+**
- For session storage and caching
- Minimum: 1GB RAM
- Production: 4GB+ RAM
- Persistence: AOF + RDB snapshots

### Environment Variables

Create a `.env` file with the following configuration:

```bash
# ============================================
# DATABASE CONFIGURATION
# ============================================
DATABASE_URL="postgresql://username:password@localhost:5432/pmcrm?schema=public"
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_POOL_IDLE_TIMEOUT=10000

# ============================================
# REDIS CONFIGURATION
# ============================================
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD="your-redis-password"
REDIS_TLS_ENABLED=false

# ============================================
# APPLICATION CONFIGURATION
# ============================================
NODE_ENV="production"
PORT=3000
API_PREFIX="/api/v1"
FRONTEND_URL="https://app.personalnetworkcrm.com"
BACKEND_URL="https://api.personalnetworkcrm.com"

# ============================================
# AUTHENTICATION & SECURITY
# ============================================
JWT_SECRET="your-256-bit-secret-key-change-in-production"
JWT_ACCESS_TOKEN_EXPIRY="1h"
JWT_REFRESH_TOKEN_EXPIRY="30d"
SESSION_SECRET="your-session-secret-key"
BCRYPT_ROUNDS=12

# Encryption (AES-256-GCM)
ENCRYPTION_KEY="your-32-byte-base64-encryption-key"
ENCRYPTION_ALGORITHM="aes-256-gcm"

# CSRF Protection
CSRF_SECRET="your-csrf-secret-key"
CSRF_COOKIE_NAME="pmcrm-csrf"

# ============================================
# OAUTH PROVIDERS
# ============================================

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="https://api.personalnetworkcrm.com/api/v1/auth/google/callback"

# Microsoft OAuth
MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
MICROSOFT_TENANT_ID="common"
MICROSOFT_CALLBACK_URL="https://api.personalnetworkcrm.com/api/v1/auth/microsoft/callback"

# ============================================
# AI/ML CONFIGURATION
# ============================================
ANTHROPIC_API_KEY="sk-ant-your-anthropic-api-key"
OPENAI_API_KEY="sk-your-openai-api-key"
OPENAI_MODEL="gpt-4o"
AI_TIMEOUT=30000
AI_MAX_RETRIES=3

# ============================================
# THIRD-PARTY INTEGRATIONS
# ============================================

# Google APIs (Contacts, Gmail, Calendar)
GOOGLE_API_KEY="your-google-api-key"

# Microsoft Graph API
MICROSOFT_GRAPH_API_URL="https://graph.microsoft.com/v1.0"

# Apollo.io (LinkedIn enrichment)
APOLLO_API_KEY="your-apollo-api-key"

# WhatsApp Business API
WHATSAPP_API_TOKEN="your-whatsapp-api-token"
WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
WHATSAPP_WEBHOOK_VERIFY_TOKEN="your-webhook-verify-token"

# ============================================
# EMAIL CONFIGURATION
# ============================================
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASSWORD="your-sendgrid-api-key"
SMTP_FROM="noreply@personalnetworkcrm.com"
SMTP_FROM_NAME="Personal Network CRM"

# ============================================
# MONITORING & LOGGING
# ============================================

# Sentry (Error tracking)
SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
SENTRY_ENVIRONMENT="production"
SENTRY_TRACES_SAMPLE_RATE=0.1

# Log Level
LOG_LEVEL="info"  # debug, info, warn, error
LOG_FORMAT="json"  # json, pretty

# Prometheus
METRICS_PORT=9090
METRICS_PATH="/metrics"

# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_REDIS_PREFIX="rl:"

# ============================================
# FILE UPLOAD
# ============================================
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/gif,text/vcard"

# Storage (S3 or local)
STORAGE_TYPE="s3"  # s3 or local
AWS_S3_BUCKET="pmcrm-uploads"
AWS_REGION="eu-west-1"
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"

# ============================================
# FEATURE FLAGS
# ============================================
ENABLE_AI_RECOMMENDATIONS=true
ENABLE_WHATSAPP_INTEGRATION=false
ENABLE_LINKEDIN_ENRICHMENT=false
ENABLE_MFA=true
ENABLE_AUDIT_LOGS=true

# ============================================
# GDPR & COMPLIANCE
# ============================================
DATA_RETENTION_DAYS=2555  # 7 years
ENABLE_COOKIE_CONSENT=true
GDPR_DPO_EMAIL="dpo@personalnetworkcrm.com"
```

### Database Setup

**1. Install PostgreSQL 16+**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-16 postgresql-contrib-16

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**2. Install pgvector Extension**

```bash
# Ubuntu/Debian
sudo apt install postgresql-16-pgvector

# Or build from source
cd /tmp
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

**3. Create Database and User**

```sql
-- Connect as postgres user
sudo -u postgres psql

-- Create database
CREATE DATABASE pmcrm;

-- Create user
CREATE USER pmcrm_user WITH ENCRYPTED PASSWORD 'your-secure-password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE pmcrm TO pmcrm_user;

-- Connect to database
\c pmcrm

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO pmcrm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pmcrm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pmcrm_user;
```

**4. Run Database Migrations**

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate:deploy

# Apply Row-Level Security policies
npm run db:apply-rls

# Seed database (optional)
npm run db:seed
```

**5. Verify Database Setup**

```bash
# Check database health
npm run db:health

# Output should show:
# ✓ Database connected
# ✓ pgvector extension enabled
# ✓ RLS policies applied
# ✓ Migrations up to date
```

### OAuth Configuration

**Google OAuth Setup**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable APIs:
   - Google People API
   - Gmail API
   - Google Calendar API
4. Configure OAuth consent screen:
   - User type: External
   - App name: Personal Network CRM
   - Support email: support@personalnetworkcrm.com
   - Scopes:
     - `openid`
     - `email`
     - `profile`
     - `https://www.googleapis.com/auth/contacts.readonly`
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/calendar.readonly`
5. Create OAuth 2.0 credentials:
   - Type: Web application
   - Authorized redirect URIs:
     - `https://api.personalnetworkcrm.com/api/v1/auth/google/callback`
     - `http://localhost:3000/api/v1/auth/google/callback` (development)
6. Copy Client ID and Client Secret to `.env`

**Microsoft OAuth Setup**

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to Azure Active Directory > App registrations
3. Click "New registration":
   - Name: Personal Network CRM
   - Supported account types: Multitenant
   - Redirect URI: `https://api.personalnetworkcrm.com/api/v1/auth/microsoft/callback`
4. Copy Application (client) ID and Directory (tenant) ID
5. Create Client Secret:
   - Navigate to Certificates & secrets
   - New client secret
   - Copy value (shown only once)
6. Set API permissions:
   - Microsoft Graph:
     - `User.Read`
     - `Contacts.Read`
     - `Contacts.ReadWrite`
     - `Mail.Read`
     - `Calendars.Read`
7. Grant admin consent for permissions
8. Add credentials to `.env`

### OpenAI/Anthropic API Setup

**Anthropic (Claude) - Primary**

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Create API key
3. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-...`
4. Set usage limits in console (recommended: $100/month)

**OpenAI (GPT-4) - Fallback**

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Create API key
3. Add to `.env`: `OPENAI_API_KEY=sk-...`
4. Set usage limits (recommended: $50/month)

---

## User Management

### Creating Admin Accounts

**Via Command Line:**

```bash
# Create admin user
npx ts-node scripts/create-admin.ts \
  --email admin@company.com \
  --password SecurePassword123! \
  --name "Admin User"

# Output:
# ✓ Admin user created successfully
# Email: admin@company.com
# Role: ADMIN
# Workspace: Default Admin Workspace
```

**Via Database:**

```sql
-- Insert admin user
INSERT INTO "User" (id, email, password, name, role, "emailVerified")
VALUES (
  gen_random_uuid(),
  'admin@company.com',
  crypt('SecurePassword123!', gen_salt('bf', 12)),
  'Admin User',
  'ADMIN',
  NOW()
);
```

### Managing Users

**List All Users:**

```bash
# CLI
npx ts-node scripts/list-users.ts

# SQL
SELECT id, email, name, role, "createdAt", "lastLoginAt"
FROM "User"
ORDER BY "createdAt" DESC;
```

**Update User Role:**

```bash
# Promote to admin
npx ts-node scripts/update-user-role.ts \
  --email user@company.com \
  --role ADMIN

# Demote to user
npx ts-node scripts/update-user-role.ts \
  --email admin@company.com \
  --role USER
```

**Disable User Account:**

```bash
npx ts-node scripts/disable-user.ts --email user@company.com

# Or via SQL
UPDATE "User"
SET "isActive" = false, "disabledAt" = NOW()
WHERE email = 'user@company.com';
```

**Delete User Account (GDPR):**

```bash
# Soft delete (retains audit logs)
npx ts-node scripts/delete-user.ts --email user@company.com --soft

# Hard delete (GDPR erasure)
npx ts-node scripts/delete-user.ts --email user@company.com --hard

# This will:
# ✓ Delete all user contacts
# ✓ Delete all user data
# ✓ Anonymize audit logs
# ✓ Revoke OAuth tokens
# ✓ Clear sessions
```

### Role Assignment

**Available Roles:**

| Role | Permissions |
|------|-------------|
| `USER` | Standard user, access own workspace |
| `ADMIN` | Full access, user management, system settings |
| `TEAM_MEMBER` | Team workspace access, limited permissions |
| `BILLING_ADMIN` | Billing management only |

**Assign Role:**

```sql
UPDATE "User"
SET role = 'ADMIN'
WHERE email = 'user@company.com';
```

### User Permissions

Permissions are role-based with workspace isolation via RLS:

**USER Permissions:**
- Create/Read/Update/Delete own contacts
- Manage own workspace
- Configure own integrations
- View own analytics

**ADMIN Permissions:**
- All USER permissions
- Create/manage users
- Access all workspaces
- Configure system settings
- View audit logs
- Manage billing

**TEAM_MEMBER Permissions:**
- Access shared workspace contacts
- Cannot delete workspace
- Limited integration access
- Cannot manage team members

---

## Workspace Management

### Creating Workspaces

Workspaces are automatically created on user registration. Manual creation:

```bash
npx ts-node scripts/create-workspace.ts \
  --name "Sales Team Workspace" \
  --owner user@company.com \
  --plan TEAM
```

### Team Invitations

**Invite Team Member:**

```bash
npx ts-node scripts/invite-team-member.ts \
  --workspace-id <workspace-uuid> \
  --email newmember@company.com \
  --role TEAM_MEMBER

# This sends invitation email
# User clicks link to join workspace
```

**Via SQL:**

```sql
-- Create invitation
INSERT INTO "TeamInvitation" (id, "workspaceId", email, role, token, "expiresAt")
VALUES (
  gen_random_uuid(),
  '<workspace-uuid>',
  'newmember@company.com',
  'TEAM_MEMBER',
  encode(gen_random_bytes(32), 'hex'),
  NOW() + INTERVAL '7 days'
);
```

### Billing Management

**View Workspace Plan:**

```sql
SELECT w.name, w.plan, w."subscriptionStatus", w."subscriptionEndsAt"
FROM "Workspace" w
WHERE w.id = '<workspace-uuid>';
```

**Update Plan:**

```bash
npx ts-node scripts/update-workspace-plan.ts \
  --workspace-id <workspace-uuid> \
  --plan ENTERPRISE \
  --subscription-id stripe_sub_xyz

# Available plans: FREE, PRO, TEAM, ENTERPRISE
```

**Check Usage Limits:**

```sql
-- Contact count per workspace
SELECT w.name, COUNT(c.id) as contact_count, w.plan
FROM "Workspace" w
LEFT JOIN "Contact" c ON c."workspaceId" = w.id
GROUP BY w.id, w.name, w.plan;
```

---

## Security

### Enabling MFA

**System-wide MFA Enforcement:**

```bash
# Update .env
ENABLE_MFA=true
MFA_REQUIRED_FOR_ADMINS=true

# Restart services
pm2 restart pmcrm-api
```

**Per-User MFA Status:**

```sql
-- Check MFA status
SELECT email, "mfaEnabled", "mfaMethod"
FROM "User"
WHERE "mfaEnabled" = true;

-- Force MFA for specific user
UPDATE "User"
SET "mfaRequired" = true
WHERE email = 'user@company.com';
```

### Security Audit Logs

**Enable Audit Logging:**

```bash
# .env
ENABLE_AUDIT_LOGS=true
AUDIT_LOG_RETENTION_DAYS=2555  # 7 years (GDPR)
```

**View Audit Logs:**

```sql
-- Recent security events
SELECT "userId", action, "ipAddress", "userAgent", "createdAt"
FROM "AuditLog"
WHERE action IN ('LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'MFA_ENABLED')
ORDER BY "createdAt" DESC
LIMIT 100;

-- Failed login attempts
SELECT "userId", "ipAddress", COUNT(*) as attempts
FROM "AuditLog"
WHERE action = 'LOGIN_FAILED'
  AND "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY "userId", "ipAddress"
HAVING COUNT(*) > 5;
```

### GDPR Compliance

**Data Export (Subject Access Request):**

```bash
npx ts-node scripts/gdpr/export-user-data.ts \
  --email user@company.com \
  --output /tmp/user-data.json

# Exports:
# - User profile
# - All contacts
# - Integration data
# - Audit logs
# - Email history
```

**Data Deletion (Right to Erasure):**

```bash
npx ts-node scripts/gdpr/delete-user-data.ts \
  --email user@company.com \
  --verify

# Prompts for confirmation
# Deletes all user data
# Anonymizes required audit logs
# Sends confirmation email
```

**Data Retention Policies:**

```sql
-- Delete old audit logs (older than retention period)
DELETE FROM "AuditLog"
WHERE "createdAt" < NOW() - INTERVAL '7 years';

-- Archive old contacts (soft delete after 90 days of account deletion)
UPDATE "Contact"
SET "archived" = true
WHERE "workspaceId" IN (
  SELECT id FROM "Workspace"
  WHERE "deletedAt" < NOW() - INTERVAL '90 days'
);
```

---

## Monitoring

### Health Checks

**System Health Endpoint:**

```bash
curl https://api.personalnetworkcrm.com/health

# Response:
{
  "status": "healthy",
  "timestamp": "2025-11-30T12:00:00Z",
  "uptime": 864000,
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "ai": "healthy"
  }
}
```

**Database Health:**

```bash
npm run db:health

# Or SQL
SELECT
  pg_database_size('pmcrm') as db_size,
  numbackends as active_connections
FROM pg_stat_database
WHERE datname = 'pmcrm';
```

### Performance Metrics

**Prometheus Metrics:**

Access metrics at: `http://localhost:9090/metrics`

Key metrics:
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `db_query_duration_seconds` - Database query latency
- `ai_requests_total` - AI API requests
- `active_users` - Current active users

**Database Performance:**

```sql
-- Slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Error Tracking

**Sentry Integration:**

Errors are automatically sent to Sentry. View dashboard:
- [https://sentry.io/organizations/pmcrm/issues/](https://sentry.io/organizations/pmcrm/issues/)

**Application Logs:**

```bash
# View logs (PM2)
pm2 logs pmcrm-api --lines 100

# View error logs only
pm2 logs pmcrm-api --err --lines 50

# Tail logs
pm2 logs pmcrm-api --lines 0
```

**Log Levels:**

```bash
# Change log level
export LOG_LEVEL=debug  # debug, info, warn, error
pm2 restart pmcrm-api --update-env
```

### Audit Logs

**View Recent Admin Actions:**

```sql
SELECT
  u.email,
  al.action,
  al.details,
  al."createdAt"
FROM "AuditLog" al
JOIN "User" u ON u.id = al."userId"
WHERE u.role = 'ADMIN'
ORDER BY al."createdAt" DESC
LIMIT 50;
```

---

## Backup & Recovery

### Backup Procedures

**Automated Daily Backup:**

```bash
# Cron job (runs daily at 2 AM)
0 2 * * * /usr/local/bin/backup-pmcrm.sh

# backup-pmcrm.sh:
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/pmcrm"
DB_NAME="pmcrm"

# Database backup
pg_dump $DB_NAME > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

# Compress
gzip "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

# Upload to S3
aws s3 cp "$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz" \
  s3://pmcrm-backups/db/db_backup_$TIMESTAMP.sql.gz

# Delete local backups older than 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

# Delete S3 backups older than 90 days
aws s3 ls s3://pmcrm-backups/db/ | while read -r line; do
  createDate=$(echo $line | awk '{print $1" "$2}')
  createDate=$(date -d "$createDate" +%s)
  olderThan=$(date -d "90 days ago" +%s)
  if [[ $createDate -lt $olderThan ]]; then
    fileName=$(echo $line | awk '{print $4}')
    aws s3 rm s3://pmcrm-backups/db/$fileName
  fi
done
```

### Restore Procedures

**Restore from Backup:**

```bash
# Download backup from S3
aws s3 cp s3://pmcrm-backups/db/db_backup_20251130_020000.sql.gz /tmp/

# Decompress
gunzip /tmp/db_backup_20251130_020000.sql.gz

# Stop application
pm2 stop pmcrm-api

# Drop and recreate database
sudo -u postgres psql -c "DROP DATABASE pmcrm;"
sudo -u postgres psql -c "CREATE DATABASE pmcrm;"

# Restore
sudo -u postgres psql pmcrm < /tmp/db_backup_20251130_020000.sql

# Restart application
pm2 start pmcrm-api

# Verify
npm run db:health
```

### Disaster Recovery Plan

**Recovery Time Objective (RTO):** 4 hours
**Recovery Point Objective (RPO):** 24 hours

**Recovery Steps:**

1. **Detect Incident**
   - Monitoring alerts (Sentry, Prometheus)
   - User reports
   - Health check failures

2. **Assess Impact**
   - Database corruption: Restore from backup
   - Service down: Restart services
   - Data breach: Isolate, investigate, notify

3. **Restore Services**
   - Provision new infrastructure (if needed)
   - Restore latest backup
   - Verify data integrity
   - Run database migrations
   - Test critical paths

4. **Verify Recovery**
   - Health checks pass
   - Login works
   - Contact sync works
   - AI recommendations work

5. **Post-Incident**
   - Document incident
   - Update runbook
   - Prevent recurrence

---

## Troubleshooting

### Common Issues

**Database Connection Issues**

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check connection limits
sudo -u postgres psql -c "SHOW max_connections;"

# Restart PostgreSQL
sudo systemctl restart postgresql
```

**OAuth Failures**

```bash
# Check OAuth credentials
npx ts-node scripts/verify-oauth.ts

# Test Google OAuth
curl "https://www.googleapis.com/oauth2/v3/userinfo" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Test Microsoft OAuth
curl "https://graph.microsoft.com/v1.0/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**API Rate Limits Exceeded**

```bash
# Check rate limit usage
redis-cli GET "rl:user:<user-id>"

# Clear rate limit for user
redis-cli DEL "rl:user:<user-id>"

# Increase rate limits in .env
RATE_LIMIT_MAX_REQUESTS=200
```

**High Memory Usage**

```bash
# Check memory usage
free -h
pm2 monit

# Restart with increased memory
pm2 delete pmcrm-api
pm2 start dist/main.js \
  --name pmcrm-api \
  --max-memory-restart 2G \
  --node-args="--max-old-space-size=4096"
```

**Slow Queries**

```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
SELECT pg_reload_conf();

-- Find slow queries
SELECT
  query,
  calls,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC;

-- Create missing indexes
CREATE INDEX CONCURRENTLY idx_contact_workspace_id ON "Contact"("workspaceId");
CREATE INDEX CONCURRENTLY idx_contact_user_id ON "Contact"("userId");
```

### Log Locations

| Service | Log Location |
|---------|-------------|
| Application | `~/.pm2/logs/pmcrm-api-out.log` |
| Error Logs | `~/.pm2/logs/pmcrm-api-error.log` |
| PostgreSQL | `/var/log/postgresql/postgresql-16-main.log` |
| Nginx | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` |
| Redis | `/var/log/redis/redis-server.log` |

### Support Escalation

**Level 1: Application Issues**
- Contact: devops@personalnetworkcrm.com
- Response: 4 hours (business hours)

**Level 2: Database/Infrastructure**
- Contact: infrastructure@personalnetworkcrm.com
- Response: 2 hours (business hours)

**Level 3: Critical Outage**
- Contact: oncall@personalnetworkcrm.com
- Phone: +1-800-NETWORK-911
- Response: 30 minutes (24/7)

---

**Document Version:** 1.0.0
**Last Updated:** November 30, 2025
**Next Review:** February 28, 2026

For questions or updates, contact: devops@personalnetworkcrm.com
