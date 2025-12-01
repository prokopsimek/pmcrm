# ADR 004: Row-Level Security for Multi-tenancy

**Status**: Accepted

**Date**: 2025-01-15

**Deciders**: Architecture Team, Security Team

## Context

As a SaaS platform, we need to support multiple tenants (users) while ensuring complete data isolation. We evaluated three primary multi-tenancy patterns:

### Option 1: Shared Database, Shared Schema with RLS
- All tenants share same database and tables
- PostgreSQL Row-Level Security (RLS) enforces isolation
- `user_id` column on all tenant-scoped tables

### Option 2: Shared Database, Separate Schemas
- All tenants share database instance
- Each tenant gets dedicated schema
- Schema name based on tenant ID

### Option 3: Separate Databases
- Each tenant gets dedicated database instance
- Maximum isolation
- Highest operational complexity

### Comparison Matrix

| Criteria | Shared Schema + RLS | Separate Schemas | Separate Databases |
|----------|-------------------|------------------|-------------------|
| **Data Isolation** | Medium | High | Maximum |
| **Security** | Medium (DB-enforced) | High | Maximum |
| **Performance** | High | Medium | Medium |
| **Cost** | Low | Medium | High |
| **Operational Complexity** | Low | Medium | High |
| **Migrations** | Simple | Medium | Complex |
| **Tenant Provisioning** | Instant | Fast (~seconds) | Slow (~minutes) |
| **Cross-tenant Analytics** | Easy | Medium | Hard |
| **Suitable for MVP** | ✅ Yes | ⚠️ Maybe | ❌ No |

## Decision

We will use **Shared Database, Shared Schema with Row-Level Security (RLS)** for our multi-tenant architecture.

### Implementation Details

#### 1. Database Schema
All tenant-scoped tables include `user_id`:

```sql
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    -- other columns...
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. Row-Level Security Policies

Enable RLS on all tenant tables:

```sql
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own data
CREATE POLICY tenant_isolation_contacts ON contacts
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Policy for inserts
CREATE POLICY tenant_isolation_contacts_insert ON contacts
    FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id')::UUID);
```

#### 3. Application-Level Implementation

Set tenant context on every database connection:

```typescript
// NestJS Interceptor
export class TenantContextInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const userId = request.user.id;

    // Set session variable for RLS
    await this.prisma.$executeRaw`
      SET app.current_user_id = ${userId}
    `;

    return next.handle();
  }
}
```

#### 4. Indexes for Performance

```sql
-- Partial index excluding soft-deleted records
CREATE INDEX idx_contacts_user
    ON contacts(user_id)
    WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX idx_contacts_user_last_contact
    ON contacts(user_id, last_contact_date DESC);
```

## Consequences

### Positive

1. **Rapid Development**:
   - Simple to implement
   - Standard SQL queries
   - Easy to reason about
   - Faster MVP delivery

2. **Cost Effective**:
   - Single database to manage
   - Efficient resource usage
   - Lower hosting costs
   - Minimal operational overhead

3. **Performance**:
   - No cross-database joins needed
   - Efficient connection pooling
   - Better cache utilization
   - Fast queries with proper indexing

4. **Operational Simplicity**:
   - Single backup/restore process
   - One migration to run
   - Simple monitoring
   - Easy disaster recovery

5. **Analytics**:
   - Cross-tenant analytics trivial
   - Aggregate metrics easy to compute
   - Business intelligence straightforward

### Negative

1. **Security Considerations**:
   - RLS bugs could leak data
   - Must never bypass RLS in application code
   - Mitigation: Comprehensive testing, security audits

2. **Limited Isolation**:
   - Noisy neighbor problem possible
   - One tenant can't have custom schema
   - Mitigation: Query timeouts, resource limits

3. **Compliance Concerns**:
   - Some enterprises require separate databases
   - May need hybrid approach later
   - Mitigation: Document as enterprise tier requirement

4. **Performance at Scale**:
   - Large table scans affect all tenants
   - Mitigation: Partitioning by user_id for large tables

### Risk Mitigation

#### Security Safeguards

1. **Always set tenant context**: Use interceptor on all requests
2. **Audit logging**: Log all RLS policy violations
3. **Automated testing**: Integration tests verify isolation
4. **Code review**: Ensure no queries bypass RLS

```typescript
// BAD: Bypasses RLS
const contacts = await prisma.contact.findMany();

// GOOD: RLS enforces isolation
const contacts = await prisma.contact.findMany({
  where: { userId: currentUser.id }
});
```

#### Performance Optimizations

1. **Table Partitioning**: For tables >100M rows, partition by user_id
2. **Connection Pooling**: PgBouncer in transaction mode
3. **Read Replicas**: Offload analytics queries
4. **Caching**: Redis cache for frequently accessed data

## Migration Path to Higher Tiers

### Enterprise Tier (Separate Schema)

For customers requiring stronger isolation:

```sql
-- Create tenant schema
CREATE SCHEMA tenant_abc123;

-- Grant access
GRANT USAGE ON SCHEMA tenant_abc123 TO app_user;

-- Create tables in tenant schema
CREATE TABLE tenant_abc123.contacts (
    -- same structure
);
```

### Regulated Industries (Separate Database)

For healthcare, finance requiring maximum isolation:

1. Provision dedicated RDS instance
2. Same schema, different database
3. Connection string per tenant

## Testing Strategy

1. **Unit Tests**: Mock RLS context setting
2. **Integration Tests**: Verify cross-tenant isolation
3. **Security Tests**: Attempt to access other tenant data
4. **Performance Tests**: Benchmark with realistic tenant counts

### Example Test

```typescript
describe('Tenant Isolation', () => {
  it('should prevent access to other tenant data', async () => {
    // User A creates contact
    const contactA = await createContact(userA, { name: 'Alice' });

    // User B tries to access
    setTenantContext(userB);
    const contact = await getContact(contactA.id);

    expect(contact).toBeNull(); // Should not find contact
  });
});
```

## Monitoring

Key metrics to track:

1. **RLS Performance**: Query execution time with RLS
2. **Policy Violations**: Attempts to bypass RLS
3. **Tenant Distribution**: Data size per tenant
4. **Query Patterns**: Identify optimization opportunities

## Review Criteria

Re-evaluate this decision when:

- **Tenant count** > 10,000 active tenants
- **Compliance requirements** mandate separate databases
- **Performance degradation** despite optimization
- **Enterprise deals** require dedicated infrastructure

## References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Citus Multi-tenant Guide](https://docs.citusdata.com/en/stable/use_cases/multi_tenant.html)
- [AWS RDS Multi-tenant Patterns](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html)

## Approved By

- Chief Architect
- VP Engineering
- Security Lead
- Compliance Officer
