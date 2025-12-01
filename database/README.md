# Personal Network CRM - Database Documentation

Complete database schema and implementation for a multi-tenant SaaS CRM with Row-Level Security (RLS).

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Schema Design](#schema-design)
3. [Multi-Tenancy with RLS](#multi-tenancy-with-rls)
4. [Setup & Migration](#setup--migration)
5. [Usage Examples](#usage-examples)
6. [Performance Optimization](#performance-optimization)
7. [GDPR Compliance](#gdpr-compliance)
8. [Maintenance](#maintenance)

---

## Architecture Overview

### Technology Stack

- **Database**: PostgreSQL 16+
- **ORM**: Prisma 5+
- **Extensions**:
  - `uuid-ossp` - UUID generation
  - `pgvector` - Vector embeddings for AI
  - `pg_trgm` - Fuzzy text search

### Multi-Tenant Strategy

The database uses **shared schema with Row-Level Security (RLS)** for tenant isolation:

- ✅ **Cost-effective**: Single database, shared infrastructure
- ✅ **Secure**: PostgreSQL RLS ensures data isolation at database level
- ✅ **Scalable**: Can handle thousands of tenants
- ✅ **Maintainable**: Single schema, unified migrations

### Database Size Estimates

| Tenants | Contacts/User | Estimated Size |
|---------|---------------|----------------|
| 100     | 500           | ~50 MB         |
| 1,000   | 500           | ~500 MB        |
| 10,000  | 500           | ~5 GB          |
| 100,000 | 500           | ~50 GB         |

---

## Schema Design

### Core Entities

#### 1. Users (Tenants)
- Primary tenant entity
- Stores subscription tier, settings, preferences
- Soft delete support

#### 2. Contacts
- Core entity for personal network
- Relationship strength scoring (1-10)
- Full-text search via tsvector
- Soft delete support
- GDPR consent tracking

#### 3. Organizations
- Companies where contacts work
- Historical employment tracking via `contact_employments`
- Data enrichment support

#### 4. Interactions
- Timeline of all touchpoints
- Email, meetings, calls, messages
- Sentiment analysis
- AI topic extraction
- Links to participants via junction table

#### 5. Reminders
- Scheduled follow-ups
- Recurrence support (RRULE format)
- Priority levels
- Notification preferences

#### 6. AI Insights
- AI-generated recommendations
- Confidence scores
- Expiration dates
- Status tracking (pending/actioned/dismissed)

#### 7. Tags
- User-defined labels for contacts
- Color coding
- Many-to-many via `contact_tags`

#### 8. Integrations
- OAuth connections
- Token storage (encrypted in production)
- Sync state tracking

#### 9. Audit Logs
- GDPR compliance
- 7-year retention
- Change tracking

#### 10. Consent Records
- GDPR consent management
- Withdrawal tracking
- IP and user agent logging

### Entity Relationship Diagram

```
Users (1) ----< (N) Contacts
Users (1) ----< (N) Organizations
Users (1) ----< (N) Interactions
Users (1) ----< (N) Reminders
Users (1) ----< (N) AI Insights
Users (1) ----< (N) Tags

Contacts (N) ----< (N) Organizations (via contact_employments)
Contacts (N) ----< (N) Interactions (via interaction_participants)
Contacts (N) ----< (N) Tags (via contact_tags)
```

---

## Multi-Tenancy with RLS

### How RLS Works

Row-Level Security ensures users can only access their own data at the **database level**, independent of application logic.

#### Setting User Context

Before each request, set the current user:

```typescript
import { setUserContext } from './database/utils';

// At request start (e.g., NestJS middleware)
await setUserContext(prisma, userId);

// Now all queries are automatically filtered by user_id
const contacts = await prisma.contact.findMany(); // Only returns user's contacts
```

#### RLS Policies

All tenant-scoped tables have policies like:

```sql
CREATE POLICY tenant_isolation_contacts ON contacts
    USING (user_id = current_setting('app.current_user_id')::UUID);
```

This means:
- User A cannot see User B's contacts
- Even if application has a bug, database enforces isolation
- Service roles can bypass RLS for background jobs

### Bypassing RLS (Admin/Background Jobs)

For admin operations or background jobs:

```typescript
// Use service role connection (set in DATABASE_URL_SERVICE)
// Or temporarily disable RLS
await prisma.$executeRaw`SET LOCAL row_security = off`;
```

---

## Setup & Migration

### Prerequisites

```bash
# Install dependencies
npm install prisma @prisma/client

# Install PostgreSQL (if not using hosted)
brew install postgresql@16  # macOS
```

### Environment Variables

```env
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/pmcrm?schema=public"
DATABASE_URL_SERVICE="postgresql://service_role:password@localhost:5432/pmcrm"
```

### Initial Setup

```bash
# 1. Generate Prisma Client
npx prisma generate

# 2. Run migrations
npx prisma migrate deploy

# 3. Apply RLS policies
psql $DATABASE_URL -f database/scripts/001_enable_rls.sql

# 4. Apply indexes
psql $DATABASE_URL -f database/scripts/002_indexes_and_performance.sql

# 5. Apply triggers and functions
psql $DATABASE_URL -f database/scripts/003_triggers_and_functions.sql

# 6. Seed development data
npx prisma db seed
```

### Migration Workflow

```bash
# Make schema changes in prisma/schema.prisma

# Generate migration
npx prisma migrate dev --name add_new_field

# Deploy to production
npx prisma migrate deploy
```

---

## Usage Examples

### Basic CRUD with RLS

```typescript
import prisma, { setUserContext } from './database/utils';

// Set user context (once per request)
await setUserContext(prisma, 'user-uuid-here');

// Create contact
const contact = await prisma.contact.create({
  data: {
    userId: 'user-uuid-here',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    relationshipStrength: 7,
  },
});

// Find contacts (automatically filtered by RLS)
const contacts = await prisma.contact.findMany({
  where: {
    relationshipStrength: { gte: 7 },
  },
  orderBy: { lastContactDate: 'desc' },
});

// Update contact
await prisma.contact.update({
  where: { id: contact.id },
  data: { relationshipStrength: 8 },
});

// Soft delete
await prisma.contact.update({
  where: { id: contact.id },
  data: { deletedAt: new Date() },
});
```

### Full-Text Search

```typescript
import { searchContacts } from './database/utils';

// Search contacts
const results = await searchContacts(
  userId,
  'john & developer',  // PostgreSQL tsquery syntax
  20  // limit
);
```

### Pagination

```typescript
import { paginate } from './database/utils';

const result = await paginate(
  prisma.contact,
  { userId: 'user-uuid' },
  {
    page: 1,
    pageSize: 20,
    orderBy: { createdAt: 'desc' },
  }
);

console.log(result.meta.totalPages);
console.log(result.data); // Array of contacts
```

### Transactions

```typescript
import { withTransaction } from './database/utils';

await withTransaction(async (tx) => {
  const contact = await tx.contact.create({
    data: { /* ... */ },
  });

  await tx.interaction.create({
    data: {
      userId: 'user-uuid',
      interactionType: 'meeting',
      participants: {
        create: [{ contactId: contact.id }],
      },
    },
  });

  // Both or neither - atomic operation
});
```

### Relationship Strength Calculation

```typescript
// Automatically calculated via trigger on interaction insert
await prisma.interaction.create({
  data: {
    userId: 'user-uuid',
    interactionType: 'email',
    occurredAt: new Date(),
    participants: {
      create: [{ contactId: 'contact-uuid' }],
    },
  },
});

// Contact's relationship_strength and last_contact_date auto-updated
```

---

## Performance Optimization

### Indexing Strategy

1. **Composite Indexes**: User-scoped queries
   ```sql
   CREATE INDEX idx_contacts_user ON contacts(user_id, deleted_at);
   ```

2. **Partial Indexes**: Filter soft-deleted
   ```sql
   CREATE INDEX idx_contacts_active ON contacts(user_id) WHERE deleted_at IS NULL;
   ```

3. **GIN Indexes**: Full-text search, JSONB
   ```sql
   CREATE INDEX idx_contacts_search ON contacts USING GIN(search_vector);
   ```

### Connection Pooling

Use PgBouncer for production:

```ini
[pgbouncer]
pool_mode = transaction  # Required for RLS
default_pool_size = 25
max_client_conn = 100
```

### Query Optimization

1. **Use select specific fields**
   ```typescript
   await prisma.contact.findMany({
     select: { id: true, firstName: true, email: true },
   });
   ```

2. **Batch queries**
   ```typescript
   const [contacts, interactions] = await Promise.all([
     prisma.contact.findMany(),
     prisma.interaction.findMany(),
   ]);
   ```

3. **Use raw queries for complex analytics**
   ```typescript
   await prisma.$queryRaw`
     SELECT /* optimized query */
   `;
   ```

---

## GDPR Compliance

### Data Subject Rights

#### Right to Access
```typescript
// Export all user data
const userData = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    contacts: true,
    interactions: true,
    reminders: true,
    // ... all relations
  },
});

// Return as JSON
return JSON.stringify(userData, null, 2);
```

#### Right to Erasure
```typescript
// Soft delete (90-day grace period)
await prisma.user.update({
  where: { id: userId },
  data: { deletedAt: new Date() },
});

// Hard delete after 90 days (automated job)
await prisma.$executeRaw`
  SELECT purge_deleted_contacts(90);
`;
```

#### Right to Portability
```typescript
// Export in machine-readable format (JSON/CSV)
const contacts = await prisma.contact.findMany({
  where: { userId },
  select: {
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    // ... fields
  },
});

// Convert to CSV
const csv = convertToCSV(contacts);
```

### Consent Management

```typescript
// Record consent
await prisma.consentRecord.create({
  data: {
    userId,
    consentType: 'data_processing',
    purpose: 'Contact management',
    granted: true,
    grantedAt: new Date(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  },
});

// Withdraw consent
await prisma.consentRecord.update({
  where: { id: consentId },
  data: { withdrawnAt: new Date() },
});
```

### Audit Logging

All sensitive operations are logged:

```typescript
// Automatic via trigger
UPDATE contacts SET email = 'new@email.com' WHERE id = '...';

// Audit log automatically created with:
// - old_values: { email: 'old@email.com' }
// - new_values: { email: 'new@email.com' }
// - user_id, timestamp, ip_address
```

---

## Maintenance

### Routine Tasks

#### 1. Vacuum Database (Weekly)
```sql
VACUUM ANALYZE;
```

#### 2. Reindex (Monthly)
```sql
REINDEX DATABASE pmcrm;
```

#### 3. Purge Old Soft-Deleted Records (Daily)
```sql
SELECT purge_deleted_contacts(90);
```

#### 4. Archive Old Audit Logs (Quarterly)
```sql
-- Move audit logs older than 3 years to archive table
INSERT INTO audit_logs_archive
SELECT * FROM audit_logs
WHERE created_at < NOW() - INTERVAL '3 years';

DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '3 years';
```

### Monitoring

```typescript
import { healthCheck } from './database/utils';

// Check database health
const health = await healthCheck();
console.log(health);
// { database: true, latencyMs: 12 }
```

### Backup Strategy

```bash
# Daily backup
pg_dump pmcrm > backup_$(date +%Y%m%d).sql

# Point-in-time recovery (enable WAL archiving)
# In postgresql.conf:
# wal_level = replica
# archive_mode = on
# archive_command = 'cp %p /archive/%f'
```

### Scaling Considerations

When to scale:

| Metric | Threshold | Action |
|--------|-----------|--------|
| DB Size | > 100 GB | Consider partitioning by user_id |
| Connections | > 80% pool | Increase pool size or add read replicas |
| Query latency | > 200ms p95 | Add indexes, optimize queries |
| CPU usage | > 80% | Vertical scaling or read replicas |

---

## Troubleshooting

### Common Issues

#### 1. RLS Not Working
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check current user context
SELECT current_setting('app.current_user_id', true);
```

#### 2. Slow Queries
```sql
-- Enable query logging
SET log_statement = 'all';
SET log_duration = on;

-- Find slow queries
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

#### 3. Connection Pool Exhausted
```typescript
// Check pool metrics
const { activeConnections } = poolMonitor.getMetrics();
console.log('Active:', activeConnections);

// Increase pool size in .env
DATABASE_URL="...?connection_limit=20"
```

---

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL RLS Guide](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PgBouncer Documentation](https://www.pgbouncer.org/)
- [GDPR Compliance Guide](https://gdpr.eu/)

---

## Support

For questions or issues:
1. Check this documentation
2. Review Prisma schema comments
3. Check audit logs for data issues
4. Review database/scripts for SQL functions

---

**Last Updated**: 2024-11-29
**Schema Version**: 1.0.0
**Prisma Version**: 5.x
