# Developer Guide

**Personal Network CRM - Developer Documentation**
**Version:** 1.0.0

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Architecture Overview](#architecture-overview)
3. [Code Conventions](#code-conventions)
4. [API Documentation](#api-documentation)
5. [Testing](#testing)
6. [Contributing](#contributing)
7. [Deployment](#deployment)

---

## Development Setup

### Prerequisites

Install the following tools:

- **Node.js** 20.x or later ([Download](https://nodejs.org))
- **npm** 10.0.0 or later (comes with Node.js)
- **PostgreSQL** 16+ with pgvector extension
- **Redis** 7.x or later
- **Git** for version control
- **VS Code** (recommended IDE)

### Clone Repository

```bash
git clone https://github.com/dxheroes/pmcrm.git
cd pmcrm
```

### Install Dependencies

```bash
# Install all workspace dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Environment Configuration

**Backend (.env):**

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your local configuration:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/pmcrm_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="dev-secret-change-in-production"
JWT_ACCESS_TOKEN_EXPIRY="1h"
JWT_REFRESH_TOKEN_EXPIRY="30d"

# OAuth (get from Google/Microsoft dev consoles)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"

# AI (optional for development)
ANTHROPIC_API_KEY="sk-ant-your-key"
OPENAI_API_KEY="sk-your-key"

# Environment
NODE_ENV="development"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

**Frontend (.env.local):**

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

### Database Setup

**1. Start PostgreSQL:**

```bash
# macOS (Homebrew)
brew services start postgresql@16

# Ubuntu/Linux
sudo systemctl start postgresql
```

**2. Create Database:**

```bash
# Create database
createdb pmcrm_dev

# Or using psql
psql postgres
CREATE DATABASE pmcrm_dev;
\q
```

**3. Install pgvector Extension:**

```bash
# macOS
brew install pgvector

# Ubuntu
sudo apt install postgresql-16-pgvector

# Enable extension
psql pmcrm_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**4. Run Migrations:**

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

**5. Seed Database (Optional):**

```bash
npm run db:seed
```

### Running Locally

**Terminal 1 - Backend:**

```bash
cd backend
npm run start:dev

# Server will start on http://localhost:3001
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev

# App will start on http://localhost:3000
```

**Terminal 3 - Redis (if not running):**

```bash
redis-server
```

### Verify Setup

1. Open [http://localhost:3000](http://localhost:3000)
2. Create an account or sign in
3. Check API health: [http://localhost:3001/health](http://localhost:3001/health)

---

## Architecture Overview

### System Architecture

```
┌─────────────────┐
│   Frontend      │
│   (Next.js)     │  Port 3000
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────┐
│   Backend API   │
│   (NestJS)      │  Port 3001
└────────┬────────┘
         │
    ┌────┴─────┬──────────┬──────────┐
    ▼          ▼          ▼          ▼
┌───────┐  ┌──────┐  ┌──────┐  ┌──────────┐
│Postgres│ │Redis │  │OpenAI│  │  OAuth   │
│+pgvector││      │  │Claude│  │ Providers│
└────────┘  └──────┘  └──────┘  └──────────┘
```

### Module Structure

```
backend/src/
├── modules/
│   ├── auth/              # Authentication & authorization
│   ├── users/             # User management
│   ├── contacts/          # Contact CRUD operations
│   ├── integrations/      # Third-party integrations
│   │   ├── google-contacts/
│   │   ├── microsoft-contacts/
│   │   └── email-sync/
│   ├── ai/                # AI recommendations
│   ├── search/            # Semantic search
│   ├── dashboard/         # Dashboard endpoints
│   ├── reminders/         # Follow-up reminders
│   └── teams/             # Team management
├── common/                # Shared utilities
├── config/                # Configuration
└── main.ts                # Application entry point

frontend/src/
├── app/                   # Next.js App Router pages
│   ├── (auth)/           # Auth pages
│   ├── dashboard/        # Dashboard pages
│   ├── contacts/         # Contact pages
│   └── settings/         # Settings pages
├── components/           # React components
├── lib/                  # Utilities
├── hooks/                # Custom React hooks
└── types/                # TypeScript types
```

### Database Schema

See Prisma schema at `/backend/prisma/schema.prisma`

Key tables:
- `User` - User accounts
- `Workspace` - Multi-tenant workspaces
- `Contact` - Contact records
- `Integration` - OAuth integrations
- `Reminder` - Follow-up reminders
- `AIRecommendation` - AI suggestions
- `AuditLog` - Security audit trail

### API Design

**REST API following best practices:**

- Versioned: `/api/v1`
- Resource-based URLs
- HTTP verbs: GET, POST, PUT, DELETE
- Status codes: 200, 201, 400, 401, 404, 500
- JSON request/response
- JWT authentication

---

## Code Conventions

### TypeScript Guidelines

**Use strict mode:**

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Prefer interfaces over types:**

```typescript
// ✅ Good
interface User {
  id: string;
  email: string;
  name: string;
}

// ❌ Avoid (unless necessary)
type User = {
  id: string;
  email: string;
};
```

**Use async/await over Promises:**

```typescript
// ✅ Good
async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  return user;
}

// ❌ Avoid
function getUser(id: string) {
  return prisma.user.findUnique({ where: { id } })
    .then(user => user);
}
```

### Naming Conventions

**Files:**
- Components: `PascalCase.tsx` (e.g., `ContactList.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Tests: `*.spec.ts` or `*.test.ts`

**Variables:**
```typescript
// camelCase for variables and functions
const userName = "John";
function getUserById(id: string) {}

// PascalCase for classes and interfaces
class ContactService {}
interface ContactDto {}

// UPPER_CASE for constants
const API_BASE_URL = "https://api.example.com";
```

### File Organization

**Backend Module Structure:**

```
modules/contacts/
├── contacts.controller.ts    # HTTP routes
├── contacts.service.ts       # Business logic
├── contacts.module.ts        # NestJS module
├── dto/                      # Data Transfer Objects
│   ├── create-contact.dto.ts
│   └── update-contact.dto.ts
├── entities/                 # Domain entities
│   └── contact.entity.ts
└── tests/
    ├── contacts.controller.spec.ts
    └── contacts.service.spec.ts
```

**Frontend Component Structure:**

```
components/contacts/
├── ContactList.tsx           # Main component
├── ContactCard.tsx           # Sub-component
├── ContactForm.tsx
├── index.ts                  # Barrel export
└── __tests__/
    └── ContactList.test.tsx
```

### Testing Requirements

**Coverage Requirements:**

- Unit tests: 80%+ coverage
- Integration tests: Critical paths
- E2E tests: User flows

**Test Structure:**

```typescript
describe('ContactService', () => {
  describe('createContact', () => {
    it('should create a contact successfully', async () => {
      // Arrange
      const dto = { name: 'John Doe', email: 'john@example.com' };

      // Act
      const result = await service.createContact(dto);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(dto.email);
    });

    it('should throw error for duplicate email', async () => {
      // Test error cases
    });
  });
});
```

---

## API Documentation

See detailed API reference at `/docs/api/API_REFERENCE.md`

**Quick Reference:**

### Authentication

```bash
# Login
POST /api/v1/auth/login
Body: { "email": "user@example.com", "password": "password" }

# OAuth
GET /api/v1/auth/google
GET /api/v1/auth/microsoft
```

### Contacts

```bash
# List contacts
GET /api/v1/contacts?page=1&limit=20

# Get contact
GET /api/v1/contacts/:id

# Create contact
POST /api/v1/contacts
Body: { "firstName": "John", "lastName": "Doe", "email": "john@example.com" }

# Update contact
PUT /api/v1/contacts/:id

# Delete contact
DELETE /api/v1/contacts/:id
```

### Integrations

```bash
# Google Contacts
POST /api/v1/integrations/google-contacts/import
GET /api/v1/integrations/google-contacts/sync

# Microsoft 365
POST /api/v1/integrations/microsoft-contacts/import
```

---

## Testing

### Unit Tests

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test contacts.service.spec.ts
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration

# Requires test database
DATABASE_URL="postgresql://localhost:5432/pmcrm_test" npm run test:integration
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run specific browser
npm run test:e2e:chromium
```

### Writing Tests

**Unit Test Example:**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ContactsService', () => {
  let service: ContactsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactsService, PrismaService],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a contact', async () => {
    const dto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    };

    const contact = await service.create(dto);
    expect(contact).toHaveProperty('id');
    expect(contact.email).toBe(dto.email);
  });
});
```

**E2E Test Example:**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Contact Management', () => {
  test('should create a new contact', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Navigate to contacts
    await page.click('text=Contacts');

    // Create contact
    await page.click('text=Add Contact');
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="email"]', 'john@example.com');
    await page.click('button:has-text("Save")');

    // Verify
    await expect(page.locator('text=John Doe')).toBeVisible();
  });
});
```

---

## Contributing

### Git Workflow

**1. Create Feature Branch:**

```bash
git checkout main
git pull origin main
git checkout -b feature/add-whatsapp-integration
```

**2. Make Changes:**

```bash
# Make your changes
# Write tests
# Ensure all tests pass
npm test
npm run lint
npm run type-check
```

**3. Commit Changes:**

```bash
# Follow Conventional Commits
git add .
git commit -m "feat: add WhatsApp integration"

# Commit message format:
# <type>(<scope>): <subject>
#
# type: feat, fix, docs, style, refactor, test, chore
# scope: module name (optional)
# subject: brief description
```

**4. Push and Create PR:**

```bash
git push origin feature/add-whatsapp-integration

# Create PR on GitHub
# Fill in PR template
# Request reviews
```

### Code Review Process

**PR Checklist:**

- [ ] All tests pass
- [ ] Code coverage maintained or improved
- [ ] Documentation updated
- [ ] No linting errors
- [ ] Type checking passes
- [ ] Follows code conventions
- [ ] No console.log or debugging code
- [ ] Environment variables documented

**Review Guidelines:**

- At least 1 approval required
- CI/CD checks must pass
- Address all review comments
- Squash commits before merge

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No new warnings
- [ ] Added tests
- [ ] All tests pass
```

### Commit Message Conventions

**Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples:**

```bash
feat(contacts): add bulk import functionality
fix(auth): resolve OAuth token refresh issue
docs(api): update endpoint documentation
test(contacts): add unit tests for ContactService
refactor(search): improve semantic search performance
```

---

## Deployment

### Build Process

**Backend:**

```bash
cd backend
npm run build

# Output: dist/ directory
```

**Frontend:**

```bash
cd frontend
npm run build

# Output: .next/ directory
```

### Deployment Pipeline

**GitHub Actions CI/CD:**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:e2e

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: |
          railway up

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: |
          vercel --prod
```

### Environment Promotion

**Environments:**

1. **Development**: Local development
2. **Staging**: Pre-production testing
3. **Production**: Live environment

**Promotion Process:**

```bash
# Deploy to staging
git push origin main
# Automatically deploys to staging

# Verify staging
# Run smoke tests
npm run test:staging

# Promote to production
# Create release tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Deploy to production
# Manual approval in GitHub Actions
```

### Rollback Procedures

```bash
# Rollback to previous version
git revert HEAD
git push origin main

# Or rollback to specific version
git checkout v1.0.0
git push origin main --force

# Or use platform-specific rollback
railway rollback
vercel rollback
```

---

## Useful Resources

### Documentation

- [NestJS Documentation](https://docs.nestjs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Playwright Documentation](https://playwright.dev)

### Tools

- [VS Code](https://code.visualstudio.com)
- [Postman](https://www.postman.com) - API testing
- [TablePlus](https://tableplus.com) - Database GUI
- [Redis Insight](https://redis.com/redis-enterprise/redis-insight/) - Redis GUI

### VS Code Extensions

- ESLint
- Prettier
- Prisma
- GitLens
- Thunder Client (API testing)
- Error Lens
- Auto Import

---

**Document Version:** 1.0.0
**Last Updated:** November 30, 2025

For questions or contributions, contact: developers@personalnetworkcrm.com
