# Testing Guide - Personal Network CRM

Complete testing documentation for the Personal Network CRM project.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Testing Stack](#testing-stack)
3. [Running Tests](#running-tests)
4. [Backend Testing](#backend-testing)
5. [Frontend Testing](#frontend-testing)
6. [E2E Testing](#e2e-testing)
7. [Test Coverage](#test-coverage)
8. [Best Practices](#best-practices)
9. [CI/CD Integration](#cicd-integration)

---

## Testing Philosophy

Our testing strategy follows the **Testing Trophy** pattern:

```
       /\
      /  \    E2E (few, high value)
     /----\
    /      \  Integration (more, focused)
   /--------\
  /          \ Unit (many, fast)
 /------------\
```

### Coverage Targets

| Layer | Target | Priority |
|-------|--------|----------|
| **GDPR Operations** | 95%+ | Critical |
| **Authentication** | 90%+ | Critical |
| **Data Access** | 85%+ | High |
| **Business Logic** | 80%+ | High |
| **UI Components** | 70%+ | Medium |

---

## Testing Stack

### Backend (NestJS)
- **Unit Tests**: Jest
- **Integration Tests**: Jest + Testcontainers
- **E2E Tests**: Jest + Supertest
- **Mocking**: Jest mock functions
- **Test Data**: Faker.js factories

### Frontend (Next.js)
- **Unit Tests**: Vitest + React Testing Library
- **Component Tests**: Vitest + React Testing Library
- **E2E Tests**: Playwright
- **Mocking**: Vitest mock functions

### Database
- **Test Database**: PostgreSQL via Testcontainers
- **Cache**: Redis via Testcontainers
- **Migrations**: Prisma migrate

---

## Running Tests

### Backend Tests

```bash
cd backend

# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run all test suites
npm run test:all
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### E2E Tests

```bash
cd e2e

# Run E2E tests
npx playwright test

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test auth.spec.ts

# Run tests for specific browser
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug

# Generate report
npx playwright show-report
```

---

## Backend Testing

### Unit Tests

Unit tests focus on testing individual functions, methods, and classes in isolation.

**Location**: `backend/src/**/*.spec.ts`

**Example**:

```typescript
// src/modules/contacts/contacts.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { ContactFactory } from '@test/factories';

describe('ContactsService', () => {
  let service: ContactsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        {
          provide: PrismaService,
          useValue: {
            contact: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a contact', async () => {
    const contactData = ContactFactory.build('user-id');

    jest.spyOn(prisma.contact, 'create').mockResolvedValue(contactData);

    const result = await service.create('user-id', contactData);

    expect(result).toEqual(contactData);
    expect(prisma.contact.create).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together correctly with real dependencies.

**Location**: `backend/test/integration/**/*.integration.spec.ts`

**Example**:

```typescript
// test/integration/contacts.integration.spec.ts
import { PrismaService } from '@/shared/prisma/prisma.service';
import { ContactsService } from '@/modules/contacts/contacts.service';
import { TestDbHelper } from '@test/helpers';

describe('ContactsService Integration', () => {
  let service: ContactsService;
  let prisma: PrismaService;
  let testUser: any;

  beforeAll(async () => {
    prisma = await TestDbHelper.initialize();
    service = new ContactsService(prisma);
  });

  beforeEach(async () => {
    await TestDbHelper.truncateAllTables();
    testUser = await TestDbHelper.seedTestUser();
  });

  it('should persist contact to database', async () => {
    const contact = await service.create(testUser.id, {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    });

    expect(contact).toHaveProperty('id');

    const retrieved = await service.findOne(testUser.id, contact.id);
    expect(retrieved.id).toBe(contact.id);
  });
});
```

### E2E Tests

E2E tests verify complete API request/response cycles.

**Location**: `backend/test/e2e/**/*.e2e-spec.ts`

**Example**:

```typescript
// test/e2e/auth.e2e-spec.ts
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';

describe('Auth API (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('POST /auth/register', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!',
        fullName: 'Test User',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body.user.email).toBe('test@example.com');
      });
  });
});
```

### Test Factories

Use factories to generate consistent test data:

```typescript
// test/factories/contact.factory.ts
import { faker } from '@faker-js/faker';

export class ContactFactory {
  static build(userId: string, overrides = {}) {
    return {
      userId,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      relationshipStrength: faker.number.int({ min: 1, max: 10 }),
      ...overrides,
    };
  }

  static buildMany(userId: string, count: number) {
    return Array.from({ length: count }, () => this.build(userId));
  }
}
```

---

## Frontend Testing

### Component Tests

Test React components in isolation using Vitest and React Testing Library.

**Location**: `frontend/src/**/*.test.tsx`

**Example**:

```typescript
// src/components/ContactCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@test/helpers/render';
import { ContactCard } from './ContactCard';
import { mockContact } from '@test/helpers/mocks';

describe('ContactCard', () => {
  it('renders contact information', () => {
    render(
      <ContactCard
        contact={mockContact}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
  });

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn();

    render(
      <ContactCard
        contact={mockContact}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Edit'));

    expect(onEdit).toHaveBeenCalledWith(mockContact.id);
  });
});
```

### Hook Tests

Test custom React hooks:

```typescript
// src/hooks/useAuth.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from './useAuth';
import { createMockFetch } from '@test/helpers/mocks';

describe('useAuth', () => {
  it('should login successfully', async () => {
    global.fetch = createMockFetch({
      accessToken: 'token',
      user: { email: 'test@example.com' }
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
  });
});
```

---

## E2E Testing

### Playwright Tests

Full end-to-end tests across the entire application.

**Location**: `e2e/tests/**/*.spec.ts`

**Example**:

```typescript
// e2e/tests/contacts.spec.ts
import { test, expect } from '../fixtures/auth.fixture';

test.describe('Contact Management', () => {
  test('should create a new contact', async ({ authenticatedPage: page }) => {
    await page.goto('/contacts/new');

    await page.fill('[name="firstName"]', 'Jane');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="email"]', 'jane@example.com');

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/contacts\/[\w-]+/);
    await expect(page.locator('text=Jane Doe')).toBeVisible();
  });

  test('should search contacts', async ({ authenticatedPage: page }) => {
    await page.goto('/contacts');

    await page.fill('[placeholder*="Search"]', 'Jane');

    await expect(page.locator('text=Jane Doe')).toBeVisible();
  });
});
```

### Authentication Fixture

Reusable authenticated session:

```typescript
// e2e/fixtures/auth.fixture.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // Register and login
    await page.goto('/auth/register');
    await page.fill('[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    await use(page);

    // Cleanup
    await page.goto('/auth/logout');
  },
});
```

---

## Test Coverage

### Viewing Coverage Reports

**Backend**:
```bash
cd backend
npm run test:cov

# Open HTML report
open coverage/index.html
```

**Frontend**:
```bash
cd frontend
npm run test:coverage

# Open HTML report
open coverage/index.html
```

### Coverage Thresholds

Coverage thresholds are enforced in `jest.config.ts` and `vitest.config.ts`:

```typescript
coverageThresholds: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
  './src/modules/auth/**/*.ts': {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90,
  },
}
```

---

## Best Practices

### 1. Test Naming Convention

```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should do something when condition', () => {
      // Test implementation
    });
  });
});
```

### 2. AAA Pattern

Structure tests using Arrange-Act-Assert:

```typescript
it('should create contact', async () => {
  // Arrange
  const userData = UserFactory.build();
  const contactData = ContactFactory.build(userData.id);

  // Act
  const result = await service.create(userData.id, contactData);

  // Assert
  expect(result).toHaveProperty('id');
  expect(result.email).toBe(contactData.email);
});
```

### 3. Test Independence

Each test should be independent and not rely on other tests:

```typescript
// Good
beforeEach(async () => {
  await TestDbHelper.truncateAllTables();
  testUser = await TestDbHelper.seedTestUser();
});

// Bad - tests depend on execution order
let sharedContact;
it('creates contact', async () => {
  sharedContact = await service.create(...);
});
it('updates contact', async () => {
  await service.update(sharedContact.id, ...); // Depends on previous test
});
```

### 4. Mock External Dependencies

Always mock external APIs and services:

```typescript
jest.mock('@/integrations/linkedin.service');

const mockLinkedInService = {
  fetchProfile: jest.fn().mockResolvedValue({ name: 'John Doe' }),
};
```

### 5. Test Error Cases

Don't just test happy paths:

```typescript
it('should throw UnauthorizedException for invalid credentials', async () => {
  await expect(
    service.login({ email: 'wrong@example.com', password: 'wrong' })
  ).rejects.toThrow(UnauthorizedException);
});
```

### 6. Use Descriptive Assertions

```typescript
// Good
expect(result.email).toBe('test@example.com');

// Bad
expect(result).toBeTruthy();
```

### 7. Avoid Test Duplication

Use helper functions and factories:

```typescript
async function createTestContact(overrides = {}) {
  const user = await TestDbHelper.seedTestUser();
  return await service.create(user.id, ContactFactory.build(user.id, overrides));
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

**Workflow stages**:

1. **Backend Unit Tests** - Fast, isolated tests
2. **Backend Integration Tests** - Tests with real database
3. **Frontend Unit Tests** - Component and hook tests
4. **E2E Tests** - Full application tests
5. **Coverage Report** - Aggregate and publish coverage

### Running Tests Locally Before Commit

```bash
# Run all tests
./scripts/test-all.sh

# Or individually
cd backend && npm run test:all
cd frontend && npm run test:coverage
cd e2e && npx playwright test
```

### Pre-commit Hooks

Install pre-commit hooks to run tests before commits:

```bash
npm install --save-dev husky lint-staged

# Add to package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.ts": ["npm run test --findRelatedTests"]
  }
}
```

---

## Troubleshooting

### Common Issues

**Tests timing out**:
```typescript
// Increase timeout
jest.setTimeout(10000);

// Or in individual test
it('slow test', async () => {
  // ...
}, 15000);
```

**Database connection issues**:
```bash
# Ensure test database is running
docker-compose up -d postgres-test

# Run migrations
npm run db:migrate:test
```

**Flaky E2E tests**:
```typescript
// Add explicit waits
await page.waitForSelector('[data-testid="contact-card"]');

// Use retry logic
await expect(async () => {
  const count = await page.locator('.contact').count();
  expect(count).toBe(5);
}).toPass({ timeout: 5000 });
```

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/react)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Testcontainers](https://testcontainers.com/)

---

## Contributing

When adding new features:

1. Write tests **before** implementation (TDD)
2. Ensure tests pass locally
3. Maintain or improve coverage thresholds
4. Add tests for edge cases and error scenarios
5. Update this documentation if needed

**Questions?** Contact the dev team or open an issue.
