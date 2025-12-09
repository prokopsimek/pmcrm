# Backend Test AGENTS.md

## Overview

Backend testing infrastructure using Jest for unit/integration tests and testcontainers for isolated database testing.

## Directory Structure

```
test/
├── AGENTS.md                      # You are here
├── setup.ts                       # Global test setup
├── setup-e2e.ts                   # E2E test setup
├── setup-integration.ts           # Integration test setup
├── jest-e2e.config.ts             # E2E Jest config
├── jest-e2e.json                  # E2E Jest config (JSON)
├── jest-integration.config.ts     # Integration Jest config
├── containers/                    # Testcontainers
│   ├── index.ts
│   ├── postgres.container.ts      # PostgreSQL container
│   └── redis.container.ts         # Redis container
├── factories/                     # Test data factories
│   ├── index.ts
│   ├── contact.factory.ts         # Contact factory
│   ├── interaction.factory.ts     # Interaction factory
│   └── user.factory.ts            # User factory
├── helpers/                       # Test utilities
│   ├── index.ts
│   ├── auth.helper.ts             # Auth test helpers
│   ├── test-db.helper.ts          # Database helpers
│   └── test-module.helper.ts      # Module creation helpers
├── e2e/                           # E2E tests
│   ├── auth.e2e-spec.ts
│   ├── contact-creation.e2e-spec.ts
│   ├── google-contacts-integration.e2e-spec.ts
│   └── ...
└── integration/                   # Integration tests
    └── contacts.integration.spec.ts
```

## Test Commands

```bash
# Unit tests (mocked dependencies)
pnpm test                          # Run all unit tests
pnpm test:watch                    # Watch mode
pnpm test:cov                      # With coverage report

# Integration tests (real database)
pnpm test:integration              # Requires Docker containers

# E2E tests (full stack)
pnpm test:e2e                      # Requires running backend

# All tests
pnpm test:all                      # Unit + Integration + E2E
```

## Test Types

### Unit Tests (`*.spec.ts` in src/)

Fast tests with mocked dependencies. Co-located with source files.

Reference: [../src/modules/contacts/contacts.service.spec.ts](../src/modules/contacts/contacts.service.spec.ts)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('ContactsService', () => {
  let service: ContactsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      contact: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    prisma = module.get(PrismaService);
  });

  describe('getContacts', () => {
    it('should return paginated contacts for user', async () => {
      const userId = 'user-123';
      const mockContacts = [{ id: '1', firstName: 'John' }];

      prisma.contact.findMany.mockResolvedValue(mockContacts);
      prisma.contact.count.mockResolvedValue(1);

      const result = await service.getContacts(userId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, deletedAt: null },
        }),
      );
    });
  });
});
```

### Integration Tests (`integration/*.spec.ts`)

Tests with real database using testcontainers.

Reference: [integration/contacts.integration.spec.ts](integration/contacts.integration.spec.ts)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PostgresContainer } from '../containers';
import { ContactsService } from '../../src/modules/contacts/contacts.service';
import { ContactFactory } from '../factories';

describe('Contacts Integration', () => {
  let app: INestApplication;
  let contactsService: ContactsService;
  let container: PostgresContainer;

  beforeAll(async () => {
    container = await PostgresContainer.start();
    // Setup module with real database
  });

  afterAll(async () => {
    await container.stop();
    await app.close();
  });

  it('should create and retrieve contact', async () => {
    const userId = 'test-user';
    const contactData = ContactFactory.build(userId);

    const created = await contactsService.createContact(userId, contactData);
    const retrieved = await contactsService.getContact(userId, created.id);

    expect(retrieved.firstName).toBe(contactData.firstName);
  });
});
```

### E2E Tests (`e2e/*.e2e-spec.ts`)

Full API tests using supertest.

Reference: [e2e/auth.e2e-spec.ts](e2e/auth.e2e-spec.ts)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthHelper } from '../helpers';

describe('Auth E2E', () => {
  let app: INestApplication;
  let authHelper: AuthHelper;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authHelper = new AuthHelper(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
    });
  });
});
```

## Example Files

### Factory Pattern

Reference: [factories/contact.factory.ts](factories/contact.factory.ts)

Key methods:
- `build(userId, overrides)` - Create data without persisting
- `buildMany(userId, count)` - Create multiple data objects
- `create(prisma, userId)` - Create and persist to database
- `buildNeedingFollowUp(userId)` - Specific test scenarios

```typescript
import { faker } from '@faker-js/faker';

export class ContactFactory {
  static build(userId: string, overrides = {}) {
    return {
      userId,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      ...overrides,
    };
  }

  static buildNeedingFollowUp(userId: string) {
    const lastContactDate = new Date();
    lastContactDate.setDate(lastContactDate.getDate() - 60);

    return this.build(userId, {
      lastContactDate,
      contactFrequencyDays: 30,
    });
  }
}
```

### Test Helper Pattern

Reference: [helpers/auth.helper.ts](helpers/auth.helper.ts)

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

export class AuthHelper {
  constructor(private app: INestApplication) {}

  async getAuthToken(userId: string): Promise<string> {
    // Generate test JWT token
  }

  async authenticatedRequest(method: string, url: string, token: string) {
    return request(this.app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${token}`);
  }
}
```

### Testcontainer Pattern

Reference: [containers/postgres.container.ts](containers/postgres.container.ts)

```typescript
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

export class PostgresContainer {
  private container: StartedPostgreSqlContainer;

  static async start(): Promise<PostgresContainer> {
    const instance = new PostgresContainer();
    instance.container = await new PostgreSqlContainer()
      .withDatabase('pmcrm_test')
      .withUsername('test')
      .withPassword('test')
      .start();
    return instance;
  }

  getConnectionString(): string {
    return this.container.getConnectionUri();
  }

  async stop(): Promise<void> {
    await this.container.stop();
  }
}
```

## Test Conventions

### Naming

- Unit tests: `{file}.spec.ts` (co-located with source)
- Integration tests: `{feature}.integration.spec.ts`
- E2E tests: `{feature}.e2e-spec.ts`

### Structure (AAA Pattern)

```typescript
describe('FeatureService', () => {
  describe('methodName', () => {
    it('should do expected behavior when condition', async () => {
      // Arrange
      const input = { ... };
      mockService.method.mockResolvedValue(expected);

      // Act
      const result = await service.method(input);

      // Assert
      expect(result).toEqual(expected);
      expect(mockService.method).toHaveBeenCalledWith(input);
    });
  });
});
```

### Mocking Best Practices

```typescript
// Mock entire module
jest.mock('../../src/lib/external-service');

// Mock specific method
const mockMethod = jest.spyOn(service, 'method').mockResolvedValue(value);

// Reset between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Verify calls
expect(mockMethod).toHaveBeenCalledTimes(1);
expect(mockMethod).toHaveBeenCalledWith(expectedArg);
```

## Coverage Requirements

Target: 80% coverage for services, 70% for controllers.

```bash
pnpm test:cov

# View report
open coverage/lcov-report/index.html
```












