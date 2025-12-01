# Backend Test Suite

This directory contains all backend tests for the Personal Network CRM.

## Structure

```
test/
├── setup.ts                      # Global unit test setup
├── setup-integration.ts          # Integration test setup
├── setup-e2e.ts                 # E2E test setup
├── jest-integration.config.ts   # Integration test config
├── jest-e2e.config.ts          # E2E test config
├── helpers/                     # Test helper functions
│   ├── test-db.helper.ts       # Database utilities
│   ├── test-module.helper.ts   # NestJS module helpers
│   └── auth.helper.ts          # Authentication helpers
├── factories/                   # Test data factories
│   ├── user.factory.ts
│   ├── contact.factory.ts
│   └── interaction.factory.ts
├── containers/                  # Testcontainers setup
│   ├── postgres.container.ts
│   └── redis.container.ts
├── integration/                 # Integration tests
│   └── *.integration.spec.ts
└── e2e/                        # E2E tests
    └── *.e2e-spec.ts
```

## Running Tests

```bash
# Unit tests (in src directory)
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:all
```

## Writing Tests

### Unit Tests

Place next to source files: `src/**/*.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { ServiceName } from './service-name.service';

describe('ServiceName', () => {
  let service: ServiceName;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ServiceName],
    }).compile();

    service = module.get(ServiceName);
  });

  it('should work', () => {
    expect(service).toBeDefined();
  });
});
```

### Integration Tests

Place in `test/integration/`: `test/integration/*.integration.spec.ts`

```typescript
import { TestDbHelper } from '@test/helpers';
import { PrismaService } from '@/shared/prisma/prisma.service';

describe('Feature Integration', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = await TestDbHelper.initialize();
  });

  beforeEach(async () => {
    await TestDbHelper.truncateAllTables();
  });

  it('should integrate with database', async () => {
    // Test implementation
  });
});
```

### E2E Tests

Place in `test/e2e/`: `test/e2e/*.e2e-spec.ts`

```typescript
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';

describe('API E2E', () => {
  let app;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('GET /', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200);
  });
});
```

## Test Helpers

### Database Helper

```typescript
import { TestDbHelper } from '@test/helpers';

// Initialize database
const prisma = await TestDbHelper.initialize();

// Clean all tables
await TestDbHelper.truncateAllTables();

// Seed test data
const user = await TestDbHelper.seedTestUser();
const contact = await TestDbHelper.seedTestContact(user.id);

// Cleanup
await TestDbHelper.cleanup();
```

### Test Factories

```typescript
import { UserFactory, ContactFactory } from '@test/factories';

// Build data without persisting
const userData = UserFactory.build();
const contacts = ContactFactory.buildMany(userId, 5);

// Create in database
const user = await UserFactory.create(prisma);
const contact = await ContactFactory.create(prisma, user.id);
```

### Auth Helper

```typescript
import { AuthTestHelper } from '@test/helpers';

// Generate test token
const token = AuthTestHelper.generateToken({
  userId: 'test-id',
  email: 'test@example.com',
});

// Generate auth header
const headers = AuthTestHelper.generateAuthHeader({
  userId: 'test-id',
  email: 'test@example.com',
});
```

## Best Practices

1. **Isolate tests** - Each test should be independent
2. **Use factories** - Generate consistent test data
3. **Clean up** - Reset state between tests
4. **Mock external services** - Don't make real API calls
5. **Test edge cases** - Include error scenarios
6. **Descriptive names** - Use clear test descriptions
7. **AAA pattern** - Arrange, Act, Assert

## Coverage

Target coverage: **80%+ overall, 90%+ for auth, 95%+ for GDPR**

View coverage:
```bash
npm run test:cov
open coverage/index.html
```

## Debugging

```bash
# Debug specific test
npm run test:debug -- --testNamePattern="test name"

# Run single file
npm test -- src/modules/auth/auth.service.spec.ts

# Verbose output
DEBUG_TESTS=1 npm test
```
