# AGENTS.md

## Project Overview

Personal Network CRM (PMCRM) is an AI-powered SaaS platform for personal business network management. It enables users to maintain, enrich, and leverage their professional contacts through intelligent automation, AI-driven insights, and seamless integrations with Google and Microsoft services.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Monorepo** | pnpm workspaces + Turborepo |
| **Backend** | NestJS 11, TypeScript, Prisma ORM |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Database** | PostgreSQL with pgvector extension |
| **Cache/Queue** | Redis, BullMQ |
| **Auth** | better-auth with JWT |
| **AI** | Google Gemini (ai-sdk) |
| **Testing** | Jest (backend), Vitest (frontend), Playwright (E2E) |

## Directory Tree with AGENTS.md Links

```
pmcrm/
├── AGENTS.md                           <- You are here
├── backend/
│   ├── AGENTS.md                       <- [Backend Guide](backend/AGENTS.md)
│   ├── src/modules/
│   │   └── AGENTS.md                   <- [Module Patterns](backend/src/modules/AGENTS.md)
│   └── test/
│       └── AGENTS.md                   <- [Test Patterns](backend/test/AGENTS.md)
├── frontend/
│   ├── AGENTS.md                       <- [Frontend Guide](frontend/AGENTS.md)
│   └── src/
│       └── AGENTS.md                   <- [Source Patterns](frontend/src/AGENTS.md)
├── database/
│   └── AGENTS.md                       <- [Database Guide](database/AGENTS.md)
├── e2e/
│   └── AGENTS.md                       <- [E2E Testing](e2e/AGENTS.md)
├── docs/
│   └── AGENTS.md                       <- [Documentation](docs/AGENTS.md)
└── infrastructure/
    └── AGENTS.md                       <- [Infrastructure](infrastructure/AGENTS.md)
```

## Setup Commands

```bash
# Full setup (install, Docker, database)
pnpm setup

# Individual steps
pnpm install                    # Install all dependencies
pnpm docker:up                  # Start PostgreSQL + Redis containers
pnpm db:generate                # Generate Prisma client
pnpm db:migrate                 # Run database migrations
```

## Database Migration Commands

```bash
pnpm db:migrate                 # Run migrations (development)
pnpm db:migrate:deploy          # Run migrations (production)
pnpm db:migrate:create <name>   # Create new migration without applying
pnpm db:migrate:status          # Check migration status
pnpm db:migrate:reset:dev       # Reset database and rerun all migrations
```

**Important:** Always use `db:migrate` instead of `db:push` to ensure schema changes
are tracked in version control and can be reproduced across environments.

## Build Commands

```bash
pnpm dev                        # Start all services (backend:3001, frontend:3000)
pnpm build                      # Build all packages
pnpm lint                       # Lint all packages
pnpm format                     # Format code with Prettier
pnpm type-check                 # TypeScript type checking
pnpm test                       # Run all unit tests
pnpm test:e2e                   # Run Playwright E2E tests
pnpm quality:check              # Full quality check (format, lint, types)
```

## Architecture Diagram

```mermaid
graph TB
    subgraph Frontend["Frontend (Next.js 16)"]
        UI[React Components]
        RQ[React Query]
        Zustand[Zustand Store]
    end

    subgraph Backend["Backend (NestJS 11)"]
        Controllers[REST Controllers]
        Services[Business Services]
        Guards[Auth Guards]
        Jobs[BullMQ Jobs]
    end

    subgraph Data["Data Layer"]
        Prisma[Prisma ORM]
        PG[(PostgreSQL)]
        Redis[(Redis)]
    end

    subgraph External["External Services"]
        Google[Google APIs]
        Microsoft[Microsoft Graph]
        AI[Google Gemini]
    end

    UI --> RQ
    RQ --> Controllers
    Controllers --> Services
    Services --> Prisma
    Services --> Jobs
    Prisma --> PG
    Jobs --> Redis
    Services --> Google
    Services --> Microsoft
    Services --> AI
```

## User Flow Diagram

```mermaid
flowchart LR
    A[User Login] --> B{Has Contacts?}
    B -->|No| C[Onboarding]
    C --> D[Connect Google/Microsoft]
    D --> E[Import Contacts]
    B -->|Yes| F[Dashboard]
    E --> F
    F --> G[View Contact]
    G --> H[AI Summary]
    G --> I[Set Reminder]
    G --> J[Add Note]
    F --> K[Global Search]
    K --> L[Semantic Search Results]
```

## Agent-Specific Examples

### Creating a New Backend Module

When creating a new NestJS module, follow this structure:

```bash
backend/src/modules/new-feature/
├── new-feature.module.ts       # Module definition
├── new-feature.controller.ts   # REST endpoints
├── new-feature.service.ts      # Business logic
├── new-feature.service.spec.ts # Unit tests
├── dto/
│   ├── index.ts               # DTO exports
│   └── create-new-feature.dto.ts
└── services/                  # Optional sub-services
```

Reference implementation: [backend/src/modules/contacts/](backend/src/modules/contacts/)

### Creating a New Frontend Hook

Custom hooks follow the `use-{resource}.ts` pattern:

```typescript
// frontend/src/hooks/use-new-feature.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { newFeatureService } from '@/lib/api/services';

export function useNewFeature() {
  return useQuery({
    queryKey: ['new-feature'],
    queryFn: newFeatureService.getAll,
  });
}
```

Reference implementation: [frontend/src/hooks/use-contacts.ts](frontend/src/hooks/use-contacts.ts)

## Terminology and Context

| Term | Definition |
|------|------------|
| **Contact** | A person in the user's professional network |
| **Organization** | A team/workspace that groups users (multi-tenancy) |
| **Reminder** | Scheduled follow-up notification for a contact |
| **Icebreaker** | AI-generated conversation starter message |
| **Enrichment** | Adding LinkedIn/external data to a contact |
| **Integration** | Connected external service (Gmail, Google Calendar, etc.) |

## Code Style

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with `@typescript-eslint`
- **Formatting**: Prettier (2 spaces, single quotes, trailing commas)
- **Commits**: Conventional commits format (`feat:`, `fix:`, `chore:`)
- **Naming**:
  - Files: `kebab-case.ts`
  - Classes: `PascalCase`
  - Functions/variables: `camelCase`
  - Constants: `SCREAMING_SNAKE_CASE`

## Environment Variables

Required environment variables (see `backend/.env.example`):

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/pmcrm"

# Auth
BETTER_AUTH_SECRET="your-secret"
BETTER_AUTH_URL="http://localhost:3001"

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Redis
REDIS_URL="redis://localhost:6379"

# AI
GOOGLE_GEMINI_API_KEY="..."
```

## Security Considerations

1. **Multi-tenancy**: Data is scoped to users via Prisma middleware
2. **Row-Level Security**: PostgreSQL RLS enabled for sensitive tables
3. **Auth**: JWT tokens with refresh token rotation
4. **Soft Deletes**: Contacts use `deletedAt` for GDPR compliance
5. **Input Validation**: DTOs with class-validator decorators

## Performance Requirements

- API response time: < 200ms (p95)
- Search queries: < 500ms with semantic search
- Frontend bundle: < 200KB gzipped
- Database connections: Pooled via PgBouncer in production

## Debugging and Troubleshooting

```bash
# Check service health
curl http://localhost:3001/api/v1/health

# View backend logs
pnpm --filter backend start:dev

# Database GUI
pnpm db:studio

# Redis CLI
docker exec -it pmcrm-redis redis-cli
```







