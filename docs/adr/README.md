# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) documenting significant architectural decisions made during the development of Personal Network CRM.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## ADR Format

Each ADR follows this structure:

1. **Title**: Short descriptive title
2. **Status**: Proposed | Accepted | Deprecated | Superseded
3. **Context**: The issue motivating this decision
4. **Decision**: The change we're proposing or have agreed to
5. **Consequences**: The results of applying this decision (both positive and negative)

## ADR Index

| # | Title | Status | Date |
|---|-------|--------|------|
| [001](./001-modular-monolith-architecture.md) | Modular Monolith Architecture | Accepted | 2025-01-15 |
| [002](./002-nestjs-backend-framework.md) | NestJS as Backend Framework | Accepted | 2025-01-15 |
| [003](./003-postgresql-with-pgvector.md) | PostgreSQL with pgvector | Accepted | 2025-01-15 |
| [004](./004-row-level-security-multi-tenancy.md) | Row-Level Security for Multi-tenancy | Accepted | 2025-01-15 |
| [005](./005-nextjs-frontend-framework.md) | Next.js 14+ App Router for Frontend | Accepted | 2025-01-15 |
| [006](./006-claude-api-for-llm.md) | Claude API as Primary LLM | Accepted | 2025-01-15 |
| [007](./007-third-party-linkedin-enrichment.md) | Third-party LinkedIn Enrichment | Accepted | 2025-01-15 |
| [008](./008-bullmq-job-queue.md) | BullMQ for Background Jobs | Accepted | 2025-01-15 |
| [009](./009-oauth2-pkce-authentication.md) | OAuth 2.0 with PKCE | Accepted | 2025-01-15 |
| [010](./010-eu-data-residency.md) | EU Data Residency Strategy | Accepted | 2025-01-15 |

## Creating a New ADR

1. Copy the template: `cp template.md XXX-your-decision-title.md`
2. Fill in the sections
3. Submit for review via pull request
4. Update this index once accepted
