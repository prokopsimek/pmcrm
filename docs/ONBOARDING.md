# Developer Onboarding Guide

Welcome to the Personal Network CRM development team! This guide will help you get up to speed quickly and become a productive contributor.

## Table of Contents

1. [Day 1: Getting Started](#day-1-getting-started)
2. [Week 1: Understanding the Codebase](#week-1-understanding-the-codebase)
3. [Week 2: First Contribution](#week-2-first-contribution)
4. [Week 3-4: Deep Dive](#week-3-4-deep-dive)
5. [Resources](#resources)
6. [Team Contacts](#team-contacts)

---

## Day 1: Getting Started

### Pre-boarding Checklist

Before your first day, you should have received:

- [ ] GitHub organization invite
- [ ] Google Workspace account (email@pmcrm.io)
- [ ] Slack workspace invite
- [ ] 1Password team vault access
- [ ] Calendar invites for team meetings
- [ ] Cloud platform access (GCP/AWS)

### Setup Your Development Environment

#### 1. Install Required Software

**macOS**:
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Install PostgreSQL
brew install postgresql@16
brew services start postgresql@16

# Install Redis
brew install redis
brew services start redis

# Install development tools
brew install git
brew install httpie
brew install jq
```

**Ubuntu/Debian**:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Install PostgreSQL
sudo apt install postgresql-16 postgresql-contrib-16
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install Redis
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Install development tools
sudo apt install git curl httpie jq
```

#### 2. Clone the Repository

```bash
# Create workspace directory
mkdir -p ~/workspace
cd ~/workspace

# Clone the repository
git clone git@github.com:dxheroes/pmcrm.git
cd pmcrm
```

#### 3. Install Dependencies

```bash
# Install Node packages
npm install

# Verify installation
npm run verify
```

#### 4. Set Up Database

```bash
# Create development database
createdb pmcrm_dev

# Install pgvector extension
psql pmcrm_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Verify PostgreSQL
psql pmcrm_dev -c "SELECT version();"
```

#### 5. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# Get shared development credentials from 1Password
nano .env
```

**Important Environment Variables**:
```env
# Database (use local for development)
DATABASE_URL="postgresql://localhost:5432/pmcrm_dev"

# Redis (local)
REDIS_URL="redis://localhost:6379"

# Get these from 1Password "Dev Environment" vault:
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
MICROSOFT_CLIENT_ID="..."
MICROSOFT_CLIENT_SECRET="..."
```

#### 6. Run Migrations and Seed Data

```bash
# Run database migrations
npm run db:migrate

# Seed with development data
npm run db:seed

# Verify database setup
psql pmcrm_dev -c "\dt"  # List tables
```

#### 7. Start Development Servers

```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend (new terminal tab)
npm run dev:frontend

# Terminal 3: Background workers (new terminal tab)
npm run dev:workers
```

#### 8. Verify Everything Works

```bash
# Check backend health
curl http://localhost:3000/health

# Expected response: {"status":"ok","info":{"database":{"status":"up"}...}}

# Open frontend
open http://localhost:3001

# Run tests
npm run test
```

### Your First Day Tasks

1. **Schedule 1:1 with your manager** - Discuss expectations and goals
2. **Join team meetings**:
   - Daily standup (10:00 AM)
   - Weekly planning (Monday 2:00 PM)
   - Tech sync (Wednesday 3:00 PM)
3. **Introduce yourself** in #dev-team Slack channel
4. **Read key documentation**:
   - [README.md](../README.md)
   - [CONTRIBUTING.md](../CONTRIBUTING.md)
   - [Architecture Overview](./adr/001-modular-monolith-architecture.md)
5. **Set up your IDE** (VSCode recommended):
   ```bash
   # Install recommended extensions
   code --install-extension dbaeumer.vscode-eslint
   code --install-extension esbenp.prettier-vscode
   code --install-extension prisma.prisma
   code --install-extension bradlc.vscode-tailwindcss
   ```

---

## Week 1: Understanding the Codebase

### Project Structure Deep Dive

#### Backend Architecture

```
src/
├── modules/              # Domain modules (modular monolith)
│   ├── contacts/        # Contact management
│   │   ├── contacts.module.ts
│   │   ├── contacts.controller.ts
│   │   ├── contacts.service.ts
│   │   ├── contacts.repository.ts
│   │   └── dto/
│   ├── users/           # User & auth
│   ├── ai/             # AI recommendations
│   ├── integrations/   # Third-party integrations
│   └── search/         # Full-text search
├── shared/             # Shared utilities
│   ├── database/       # Database client
│   ├── cache/          # Redis client
│   └── utils/          # Helper functions
├── config/             # Configuration
└── main.ts            # Application entry
```

#### Frontend Architecture

```
frontend/
├── app/                # Next.js App Router
│   ├── (auth)/        # Auth pages
│   ├── (dashboard)/   # Dashboard pages
│   └── api/           # API routes
├── components/         # React components
│   ├── ui/            # UI primitives
│   ├── contacts/      # Contact components
│   └── layout/        # Layout components
├── lib/               # Utilities
│   ├── api/           # API client
│   ├── hooks/         # Custom hooks
│   └── utils/         # Helper functions
└── public/            # Static assets
```

### Learning Path

#### Day 1-2: Core Concepts

**Read and understand**:

1. **Multi-tenancy**: [ADR-004](./adr/004-row-level-security-multi-tenancy.md)
   - How RLS works
   - Tenant isolation
   - Security implications

2. **Database Schema**: [Schema Documentation](./database/schema.md)
   - Core entities
   - Relationships
   - Indexes and performance

3. **Authentication Flow**: [Security Documentation](./security/README.md)
   - OAuth 2.0 + PKCE
   - Token management
   - MFA implementation

**Exercise**: Trace a request
```bash
# Start the app in debug mode
npm run dev:debug

# Set breakpoint in src/modules/contacts/contacts.controller.ts
# Make a request and step through the code
curl -X POST http://localhost:3000/contacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","email":"test@example.com"}'
```

#### Day 3-4: Key Modules

**Study these modules**:

1. **Contacts Module** (`src/modules/contacts/`)
   - CRUD operations
   - Relationship scoring
   - Search functionality

2. **AI Module** (`src/modules/ai/`)
   - Recommendation engine
   - Message generation
   - Trigger detection

3. **Integrations Module** (`src/modules/integrations/`)
   - Google OAuth flow
   - Contact sync
   - Webhook handling

**Exercise**: Add a feature
```
Task: Add "favorite" flag to contacts

1. Add migration:
   - Add `is_favorite BOOLEAN DEFAULT false` to contacts table
   - Run: npm run db:migrate:create add_favorite_to_contacts

2. Update Prisma schema:
   - Add field to Contact model

3. Update DTOs:
   - Add to CreateContactDto
   - Add to UpdateContactDto
   - Add to ContactResponseDto

4. Update service:
   - Add toggleFavorite() method

5. Add tests:
   - Unit tests for service
   - E2E tests for endpoint

6. Update frontend:
   - Add star icon to contact card
   - Add toggle handler
```

#### Day 5: GDPR & Security

**Read and understand**:

1. **GDPR Compliance**: [GDPR Documentation](./gdpr/compliance.md)
   - Legal basis for processing
   - Data subject rights implementation
   - Retention policies

2. **Security Practices**: [Security Documentation](./security/README.md)
   - OWASP Top 10 mitigations
   - Encryption implementation
   - Audit logging

**Exercise**: Implement GDPR right to access
```typescript
// Implement data export for a contact
async exportContactData(userId: string, contactId: string): Promise<ContactExport> {
  // 1. Verify user owns the contact (RLS)
  // 2. Fetch contact with all related data
  // 3. Fetch all interactions
  // 4. Format as JSON
  // 5. Return exportable data
}
```

### End of Week 1 Checkpoint

**Self-assessment**:
- [ ] Can run the full stack locally
- [ ] Understand the modular monolith architecture
- [ ] Can navigate the codebase confidently
- [ ] Understand the database schema
- [ ] Know how authentication works
- [ ] Familiar with GDPR requirements

**Meeting with mentor**: Discuss questions and areas needing clarification

---

## Week 2: First Contribution

### Good First Issues

Look for issues labeled `good-first-issue` on GitHub. These are specifically chosen for new contributors:

**Typical examples**:
- Add validation to existing DTOs
- Improve error messages
- Add missing tests
- Update documentation
- Add logging to services
- Implement small features

### Your First PR Workflow

#### 1. Pick an Issue

```bash
# Find a good first issue
# Visit: https://github.com/dxheroes/pmcrm/labels/good-first-issue

# Comment that you're working on it
# Example: "I'd like to work on this. ETA: 3 days"
```

#### 2. Create Feature Branch

```bash
# Update develop
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/add-email-validation

# Make your changes...
```

#### 3. Follow Code Standards

```bash
# Run linter
npm run lint

# Fix issues automatically
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check

# Run all checks
npm run validate
```

#### 4. Write Tests

```typescript
// contacts.service.spec.ts
describe('ContactsService', () => {
  describe('create', () => {
    it('should validate email format', async () => {
      const dto = {
        firstName: 'John',
        email: 'invalid-email', // Invalid format
      };

      await expect(service.create(dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should create contact with valid email', async () => {
      const dto = {
        firstName: 'John',
        email: 'john@example.com',
      };

      const result = await service.create(dto);

      expect(result).toHaveProperty('id');
      expect(result.email).toBe('john@example.com');
    });
  });
});
```

#### 5. Run Tests

```bash
# Run unit tests
npm run test

# Run affected tests only
npm run test -- contacts.service

# Check coverage
npm run test:cov

# Coverage must be >= 80%
```

#### 6. Update Documentation

```bash
# If you changed APIs, update OpenAPI spec
# If you added features, update README
# If architectural decision made, create ADR
```

#### 7. Create Pull Request

```bash
# Push your branch
git push origin feature/add-email-validation

# Create PR via GitHub UI
# Use the PR template
# Link to the issue
```

#### 8. Address Review Comments

```bash
# Make requested changes
git add .
git commit -m "fix: address review comments"
git push origin feature/add-email-validation

# PR will automatically update
```

### End of Week 2 Checkpoint

**Self-assessment**:
- [ ] Created your first PR
- [ ] Followed code standards
- [ ] Wrote tests with good coverage
- [ ] Addressed code review feedback
- [ ] PR merged successfully

**Celebration**: Your code is now in production!

---

## Week 3-4: Deep Dive

### Advanced Topics

#### Week 3: AI & ML Pipeline

**Study**:
1. Relationship scoring algorithm
2. LLM integration (Claude API)
3. Trigger detection system
4. Semantic search with pgvector

**Task**: Implement a new AI insight type
```typescript
// Example: Detect when contact posts about job search
interface JobSearchTrigger {
  contactId: string;
  source: 'linkedin' | 'email';
  confidence: number;
  signals: string[];
  suggestedAction: string;
}

async detectJobSearchSignals(contactId: string): Promise<JobSearchTrigger | null> {
  // 1. Fetch recent LinkedIn activity
  // 2. Analyze with NLP
  // 3. Calculate confidence score
  // 4. Generate recommendation
}
```

#### Week 4: Performance & Scalability

**Study**:
1. Database query optimization
2. Caching strategies (Redis)
3. Background job processing (BullMQ)
4. Horizontal scaling

**Task**: Optimize a slow query
```typescript
// Before: N+1 query problem
async getContactsWithOrganizations(userId: string): Promise<Contact[]> {
  const contacts = await prisma.contact.findMany({
    where: { userId },
  });

  // N+1: Fetches organization for each contact
  for (const contact of contacts) {
    contact.organization = await prisma.organization.findUnique({
      where: { id: contact.organizationId },
    });
  }

  return contacts;
}

// After: Single query with join
async getContactsWithOrganizations(userId: string): Promise<Contact[]> {
  return prisma.contact.findMany({
    where: { userId },
    include: {
      organization: true, // Join in single query
    },
  });
}
```

### Ownership Areas

By end of week 4, you should take ownership of specific areas:

**Backend**:
- Specific module (e.g., integrations, AI, search)
- Performance optimization
- Background jobs

**Frontend**:
- Component library
- Specific features (e.g., contact list, AI insights)
- Performance optimization

**Full-stack**:
- End-to-end features
- GDPR compliance
- Security improvements

### End of Month Checkpoint

**Meeting with manager**:
- Review contributions
- Set goals for next month
- Discuss career development
- Identify areas for growth

---

## Resources

### Internal Documentation

- [Technical Specification](../DEF.md) - Complete product spec
- [README](../README.md) - Project overview
- [Contributing Guide](../CONTRIBUTING.md) - Contribution guidelines
- [API Documentation](./api/README.md) - API reference
- [Architecture Decisions](./adr/README.md) - ADRs

### External Resources

#### NestJS
- [Official Docs](https://docs.nestjs.com/)
- [Best Practices](https://github.com/nestjs/awesome-nestjs)

#### Next.js
- [Official Docs](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)

#### PostgreSQL
- [Official Docs](https://www.postgresql.org/docs/)
- [pgvector](https://github.com/pgvector/pgvector)

#### Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GDPR Compliance](https://gdpr.eu/)

### Video Walkthroughs

**Internal recordings** (on Google Drive):
1. "Architecture Overview" (30 min)
2. "Setting Up Development Environment" (20 min)
3. "Creating Your First Feature" (45 min)
4. "AI Pipeline Deep Dive" (60 min)
5. "GDPR Compliance Implementation" (40 min)

### Books (Recommended)

1. **Clean Architecture** by Robert C. Martin
2. **Designing Data-Intensive Applications** by Martin Kleppmann
3. **Site Reliability Engineering** by Google
4. **The Pragmatic Programmer** by Hunt & Thomas

---

## Team Contacts

### Engineering Team

| Name | Role | Slack | Focus Area |
|------|------|-------|------------|
| [Name] | VP Engineering | @name | Overall architecture |
| [Name] | Tech Lead | @name | Backend, AI/ML |
| [Name] | Senior Engineer | @name | Frontend, UX |
| [Name] | Senior Engineer | @name | Infrastructure, DevOps |

### Support Channels

- **#dev-team** - General development discussion
- **#dev-help** - Ask for help
- **#deployments** - Deployment notifications
- **#incidents** - Production incidents
- **#random** - Water cooler chat

### Office Hours

- **Tech Lead Office Hours**: Tuesday 3-4 PM
- **Frontend Office Hours**: Thursday 2-3 PM
- **DevOps Office Hours**: Wednesday 4-5 PM

### Meetings

- **Daily Standup**: Mon-Fri 10:00 AM (15 min)
- **Weekly Planning**: Monday 2:00 PM (60 min)
- **Tech Sync**: Wednesday 3:00 PM (60 min)
- **Demo Day**: Last Friday of month 3:00 PM (60 min)
- **Retro**: Last Friday of month 4:00 PM (60 min)

---

## Tips for Success

### First 30 Days

1. **Ask Questions**: No question is too basic
2. **Take Notes**: Document what you learn
3. **Pair Program**: Work with teammates
4. **Read Code**: Best way to learn the codebase
5. **Small PRs**: Easy to review, quick to merge
6. **Test Everything**: Build quality from day one
7. **Share Learnings**: Help future new hires

### Communication

- **Slack** for quick questions
- **GitHub** for code discussions
- **Google Docs** for documentation
- **Video calls** for complex discussions
- **In-person** for brainstorming (if applicable)

### Work-Life Balance

- **Core hours**: 10 AM - 4 PM (your timezone)
- **Flexible schedule**: Coordinate with team
- **No weekend work** expected
- **Take breaks**: Pomodoro technique recommended
- **Vacation**: Use it! Notify team 2 weeks in advance

---

## Common Issues & Solutions

### Database Connection Issues

```bash
# Error: ECONNREFUSED 127.0.0.1:5432
# Solution: Start PostgreSQL
brew services start postgresql@16

# Error: database "pmcrm_dev" does not exist
# Solution: Create database
createdb pmcrm_dev
```

### Redis Connection Issues

```bash
# Error: ECONNREFUSED 127.0.0.1:6379
# Solution: Start Redis
brew services start redis
```

### Migration Errors

```bash
# Error: Migration failed
# Solution: Reset database (development only!)
npm run db:reset

# This will:
# 1. Drop all tables
# 2. Run all migrations
# 3. Seed data
```

### Port Already in Use

```bash
# Error: Port 3000 already in use
# Solution: Kill process using port
lsof -ti:3000 | xargs kill -9
```

---

## Feedback

We want to continuously improve this onboarding experience!

**After your first month**, please:
1. Fill out the onboarding survey
2. Share what worked well
3. Suggest improvements
4. Update this document with missing information

Contact your manager or post in #dev-team with feedback.

---

**Welcome to the team! We're excited to have you here.**

**Last Updated**: 2025-01-15
