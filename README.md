# Personal Network CRM

AI-powered SaaS platform for managing personal business networks with intelligent relationship insights and proactive networking recommendations.

## Overview

Personal Network CRM is a cloud-native SaaS application that helps professionals maintain and grow their business relationships through AI-powered recommendations, automated relationship scoring, and intelligent networking suggestions.

### Key Features

- **AI-Powered Relationship Scoring**: Automatically calculate relationship strength based on interaction frequency, recency, and type
- **Smart Networking Recommendations**: AI suggests who to contact and when, based on relationship decay, life events, and business triggers
- **Multi-Platform Integrations**: Sync contacts and interactions from Google, Microsoft, LinkedIn, WhatsApp, and more
- **Privacy-First Design**: Full GDPR compliance with EU data residency and optional end-to-end encryption
- **Cross-Platform**: Native web, iOS, and Android applications with seamless sync

## Tech Stack

### Backend
- **Framework**: NestJS (TypeScript) - Enterprise-grade Node.js framework
- **Database**: PostgreSQL 16+ with pgvector extension for semantic search
- **ORM**: Prisma - Type-safe database access with excellent migration support
- **Queue**: BullMQ (Redis-based) - Background job processing and scheduling
- **Authentication**: OAuth 2.0 / OpenID Connect with PKCE

### Frontend
- **Web**: Next.js 14+ (App Router) with Server Components
- **State Management**: TanStack Query (server state) + Zustand (client state)
- **Forms**: React Hook Form + Zod validation
- **Mobile**: React Native with Expo (future roadmap)

### AI/ML
- **LLM**: Claude API (primary) / GPT-4 (fallback)
- **Vector Database**: pgvector for semantic search
- **NLP**: spaCy + Hugging Face Transformers
- **Feature Store**: Hopsworks (open-source)

### Infrastructure
- **Hosting**: Vercel (frontend) + Railway/Render (backend)
- **Database**: Neon or Supabase (managed PostgreSQL, EU regions)
- **Cache**: Upstash (managed Redis, EU regions)
- **IaC**: Terraform
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites

- Node.js 20.x or later
- PostgreSQL 16+ with pgvector extension
- Redis 7.x or later
- npm or pnpm package manager

### Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/pmcrm"
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-secret-key-change-in-production"
JWT_ACCESS_TOKEN_EXPIRY="1h"
JWT_REFRESH_TOKEN_EXPIRY="30d"

# OAuth Providers
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"

# AI/ML
ANTHROPIC_API_KEY="your-anthropic-api-key"
OPENAI_API_KEY="your-openai-api-key"

# Third-party Services
APOLLO_API_KEY="your-apollo-api-key"  # For LinkedIn enrichment
WHATSAPP_API_TOKEN="your-whatsapp-token"

# Application
NODE_ENV="development"
PORT=3000
FRONTEND_URL="http://localhost:3001"

# Encryption
ENCRYPTION_KEY="your-32-byte-encryption-key"  # For AES-256-GCM

# Multi-tenant
TENANT_ISOLATION_STRATEGY="rls"  # rls | schema | database

# Feature Flags
ENABLE_AI_RECOMMENDATIONS=true
ENABLE_WHATSAPP_INTEGRATION=false
ENABLE_LINKEDIN_ENRICHMENT=false
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/pmcrm.git
cd pmcrm
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Install pgvector extension
psql -d pmcrm -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
npm run db:migrate

# (Optional) Seed with sample data
npm run db:seed
```

4. Start Redis:
```bash
redis-server
```

5. Start the development server:
```bash
# Backend
npm run dev:backend

# Frontend (in a separate terminal)
npm run dev:frontend
```

6. Access the application:
- Frontend: http://localhost:3001
- API: http://localhost:3000
- API Documentation: http://localhost:3000/api/docs

## Development Workflow

### Project Structure

```
pmcrm/
├── src/
│   ├── modules/           # Domain modules (modular monolith)
│   │   ├── contacts/      # Contact management
│   │   ├── users/         # Authentication & tenant management
│   │   ├── ai/            # AI recommendations
│   │   ├── integrations/  # Third-party integrations
│   │   ├── notifications/ # Email & push notifications
│   │   └── search/        # Full-text search
│   ├── shared/            # Shared utilities & database
│   ├── config/            # Configuration files
│   └── main.ts            # Application entry point
├── frontend/              # Next.js frontend
│   ├── app/              # App Router pages
│   ├── components/       # React components
│   ├── lib/              # Utilities & helpers
│   └── public/           # Static assets
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
├── docs/                 # Documentation
│   ├── adr/             # Architecture Decision Records
│   ├── api/             # API documentation
│   ├── architecture/    # System architecture
│   └── security/        # Security documentation
├── tests/                # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── infrastructure/       # Terraform & deployment configs
```

### Running Tests

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

### Database Migrations

```bash
# Create a new migration
npm run db:migrate:create -- --name add_user_preferences

# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:migrate:rollback

# Reset database (WARNING: destroys all data)
npm run db:reset
```

### Code Quality

```bash
# Linting
npm run lint

# Type checking
npm run type-check

# Format code
npm run format

# Run all checks
npm run validate
```

## Architecture

### Multi-Tenant Strategy

The application uses **Row-Level Security (RLS)** in PostgreSQL for tenant isolation:

- Shared database with shared schema
- RLS policies enforce data isolation per tenant
- Optimal for MVP phase (cost-effective, simple operations)
- Migration path to separate schemas for enterprise tier

See [Architecture Documentation](./docs/architecture/multi-tenant.md) for details.

### Security

- **Authentication**: OAuth 2.0 + PKCE for web and mobile
- **Authorization**: Role-Based Access Control (RBAC)
- **Encryption**: AES-256-GCM for PII fields, TLS 1.3 in transit
- **MFA**: TOTP and WebAuthn/FIDO2 support
- **Rate Limiting**: Per-user and per-IP limits
- **Audit Logging**: All sensitive operations logged for 7 years

See [Security Documentation](./docs/security/README.md) for details.

### GDPR Compliance

- **Legal Basis**: Legitimate Interest + Consent
- **Data Rights**: Access, Erasure, Portability, Rectification
- **EU Data Residency**: All EU user data stored in EU regions
- **Encryption**: At-rest and in-transit encryption
- **Retention Policies**: Automated data cleanup per policy
- **Consent Management**: Granular consent with audit trail

See [GDPR Documentation](./docs/gdpr/compliance.md) for details.

## API Documentation

Interactive API documentation is available at `/api/docs` when running the development server.

Key endpoints:

- `POST /auth/login` - User authentication
- `GET /contacts` - List contacts with filtering
- `POST /contacts` - Create a new contact
- `GET /contacts/:id` - Get contact details
- `PATCH /contacts/:id` - Update contact
- `DELETE /contacts/:id` - Delete contact
- `GET /ai/recommendations` - Get AI networking recommendations
- `POST /integrations/google/sync` - Sync Google contacts
- `POST /integrations/microsoft/sync` - Sync Microsoft contacts

See [API Documentation](./docs/api/README.md) for full reference.

## Deployment

### MVP Deployment (Recommended)

**Frontend**: Deploy to Vercel
```bash
vercel --prod
```

**Backend**: Deploy to Railway
```bash
railway up
```

**Database**: Use Neon or Supabase (EU region)

**Redis**: Use Upstash (EU region)

### Production Deployment

For production at scale, migrate to Kubernetes:

1. Set up GKE cluster in EU region (europe-west1 or europe-west3)
2. Apply Terraform configurations:
```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

See [Deployment Documentation](./docs/deployment/README.md) for details.

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Guidelines

1. **Branching**: Use feature branches (`feature/add-whatsapp-integration`)
2. **Commits**: Follow Conventional Commits specification
3. **Testing**: Maintain 80%+ code coverage
4. **Documentation**: Update docs with code changes
5. **Code Review**: All changes require review before merge

## Roadmap

### Phase 1: MVP (Weeks 1-12)
- [x] Core contact management
- [x] Google & Microsoft integrations
- [x] Basic AI relationship scoring
- [ ] Email reminders
- [ ] Web application

### Phase 2: Core Features (Weeks 13-24)
- [ ] WhatsApp Business API integration
- [ ] LinkedIn enrichment via Apollo.io
- [ ] Advanced AI recommendations
- [ ] Mobile app (React Native)
- [ ] Team collaboration features

### Phase 3: Scale (Weeks 25+)
- [ ] Kubernetes deployment
- [ ] Self-hosted LLM evaluation
- [ ] Advanced ML pipeline
- [ ] SOC 2 Type II certification
- [ ] Enterprise features (SSO, advanced audit logs)

## License

Copyright (c) 2025 DX Heroes. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

## Support

- **Documentation**: https://docs.pmcrm.io
- **Email**: support@pmcrm.io
- **Discord**: https://discord.gg/pmcrm
- **Status Page**: https://status.pmcrm.io

## Acknowledgments

Built with best practices from:
- OWASP Security Guidelines
- GDPR Compliance Framework
- Clean Architecture principles
- Domain-Driven Design patterns
