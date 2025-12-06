# Database AGENTS.md

## Overview

Database utilities, SQL scripts, and Prisma configurations for PostgreSQL with Row-Level Security (RLS) and pgvector extension.

## Directory Structure

```
database/
├── AGENTS.md                      # You are here
├── README.md                      # Database documentation
├── scripts/                       # SQL migration scripts
│   ├── 001_enable_rls.sql         # Row-Level Security setup
│   ├── 002_indexes_and_performance.sql  # Performance indexes
│   └── 003_triggers_and_functions.sql   # Database triggers
└── utils/                         # TypeScript utilities
    ├── index.ts                   # Exports
    ├── prisma-client.ts           # Prisma singleton
    ├── connection-pool.ts         # Connection pooling
    └── transaction-helpers.ts     # Transaction utilities
```

## Schema Location

The Prisma schema is located at: [../backend/prisma/schema.prisma](../backend/prisma/schema.prisma)

## Example Files

### Prisma Client Singleton

Reference: [utils/prisma-client.ts](utils/prisma-client.ts)

Key features:
- Singleton pattern for development
- Soft delete filtering via extensions
- RLS context helpers

```typescript
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  }).$extends({
    query: {
      contact: {
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
      },
    },
  });
};
```

### RLS Helper Functions

```typescript
// Set user context for RLS policies
export async function setUserContext(prisma: PrismaClient, userId: string) {
  await prisma.$executeRawUnsafe(`SELECT set_current_user_id('${userId}')`);
}

// Clear user context
export async function clearUserContext(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`RESET app.current_user_id`);
}
```

## SQL Scripts

> **Note:** The functionality from these SQL scripts has been migrated to Prisma migrations.
> See `backend/prisma/migrations/20251206173618_add_rls_functions_and_performance/migration.sql`
> for the production-ready implementation.

### Legacy Scripts (Reference Only)

These scripts serve as documentation and reference for the database features:

#### Row-Level Security (001_enable_rls.sql)

Reference: [scripts/001_enable_rls.sql](scripts/001_enable_rls.sql)

Enables RLS on sensitive tables:
- `contacts` - User-owned contacts
- `integrations` - OAuth tokens
- All user-scoped tables

#### Performance Indexes (002_indexes_and_performance.sql)

Reference: [scripts/002_indexes_and_performance.sql](scripts/002_indexes_and_performance.sql)

Indexes for common query patterns:
- Full-text search on contacts
- Email lookup indexes
- Timestamp-based queries

#### Triggers and Functions (003_triggers_and_functions.sql)

Reference: [scripts/003_triggers_and_functions.sql](scripts/003_triggers_and_functions.sql)

Database functions:
- `set_current_user_id()` - Set RLS context
- Updated timestamp triggers
- Soft delete helpers

## Database Commands

```bash
# From project root
pnpm db:generate                   # Generate Prisma client
pnpm db:migrate                    # Run migrations (development)
pnpm db:migrate:deploy             # Run migrations (production)
pnpm db:migrate:create <name>      # Create new migration without applying
pnpm db:migrate:status             # Check migration status
pnpm db:migrate:reset:dev          # Reset database and rerun all migrations
pnpm db:studio                     # Open Prisma Studio GUI
pnpm db:seed                       # Seed database
pnpm db:reset                      # Reset database (WARNING: deletes data)
```

**Important:** Always use migrations (`db:migrate`) instead of `db:push` for schema changes.
This ensures changes are tracked in version control and can be reproduced across environments.

## Key Concepts

### Multi-Tenancy

Data is scoped to users via `userId` foreign key on most tables. RLS policies provide an additional security layer.

### Soft Deletes

Contacts use `deletedAt` timestamp instead of hard deletes:
- `NULL` = active record
- Timestamp = deleted (hidden from queries)

The Prisma client extension automatically filters deleted records.

### Semantic Search (pgvector)

The `Contact` model includes:
```prisma
embeddingVector    Unsupported("vector(1536)")?
embeddingUpdatedAt DateTime?
```

Used for semantic search with OpenAI embeddings (1536 dimensions).

## Conventions

### Naming

- Tables: `snake_case` (Prisma maps to camelCase)
- Indexes: `idx_{table}_{columns}`
- Functions: `{verb}_{noun}`

### Migrations

**Development Workflow:**
1. Make changes to `backend/prisma/schema.prisma`
2. Create migration: `pnpm db:migrate:create {description}`
3. Review generated SQL in `backend/prisma/migrations/{timestamp}_{name}/migration.sql`
4. Apply migration: `pnpm db:migrate`

**Production Workflow:**
1. Deploy code with new migrations
2. Run: `pnpm db:migrate:deploy`

**Commands (from project root):**
```bash
pnpm db:migrate                    # Development: creates and applies migrations
pnpm db:migrate:deploy             # Production: applies pending migrations only
pnpm db:migrate:create <name>      # Create migration without applying
pnpm db:migrate:status             # Check which migrations are pending
pnpm db:migrate:reset:dev          # Reset DB and rerun all migrations (dev only)
```

**Commands (from backend directory):**
```bash
pnpm prisma migrate dev            # Development: creates and applies migrations
pnpm prisma migrate deploy         # Production: applies pending migrations only
pnpm prisma migrate status         # Check migration status
pnpm prisma migrate reset          # Reset DB (dev only, destroys data)
```

### Raw SQL Usage

Avoid raw SQL when possible. Use Prisma's query builder:

```typescript
// ✅ Prefer Prisma
const contacts = await prisma.contact.findMany({
  where: { userId, email: { contains: 'example.com' } },
});

// ❌ Avoid raw SQL unless necessary
const contacts = await prisma.$queryRaw`
  SELECT * FROM contacts WHERE user_id = ${userId}
`;
```

Use raw SQL for:
- RLS context setting
- Complex aggregations
- Trigram search
- Vector similarity search







