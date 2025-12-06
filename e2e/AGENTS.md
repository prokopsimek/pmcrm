# E2E Testing AGENTS.md

## Overview

End-to-end tests using Playwright for full user flow testing across the frontend and backend.

## Directory Structure

```
e2e/
├── AGENTS.md                      # You are here
├── README.md                      # E2E documentation
├── playwright.config.ts           # Playwright configuration
├── fixtures/                      # Test fixtures
│   ├── api.fixture.ts             # API helper fixture
│   ├── auth.fixture.ts            # Authentication fixture
│   └── database.fixture.ts        # Database fixture
└── tests/                         # Test files
    ├── accessibility.spec.ts      # A11y tests (axe-playwright)
    ├── ai-recommendations.spec.ts # AI feature tests
    ├── auth.spec.ts               # Auth flow tests
    ├── contacts.spec.ts           # Contact CRUD tests
    ├── email-sync.spec.ts         # Email integration tests
    ├── google-contacts-import.spec.ts  # Google import tests
    ├── manual-contact-creation.spec.ts # Form tests
    ├── performance.spec.ts        # Performance tests
    ├── reminders.spec.ts          # Reminder tests
    └── search.spec.ts             # Search feature tests
```

## Test Commands

```bash
# From project root
pnpm test:e2e                      # Run all E2E tests
pnpm test:e2e:ui                   # Interactive UI mode
pnpm test:e2e:headed               # Run with visible browser
pnpm test:e2e:debug                # Debug mode
pnpm test:e2e:chromium             # Chromium only
pnpm test:e2e:firefox              # Firefox only
pnpm test:e2e:webkit               # WebKit only
pnpm test:e2e:performance          # Performance tests only
pnpm test:e2e:accessibility        # A11y tests only
pnpm test:e2e:report               # View HTML report
```

## Example Files

### Auth Fixture Pattern

Reference: [fixtures/auth.fixture.ts](fixtures/auth.fixture.ts)

```typescript
import { test as base } from '@playwright/test';
import { Page } from '@playwright/test';

type AuthFixture = {
  authenticatedPage: Page;
  authToken: string;
};

export const test = base.extend<AuthFixture>({
  authToken: async ({ page }, use) => {
    // Register test user
    const email = `test-${Date.now()}@example.com`;
    const password = 'SecurePassword123!';

    await page.goto('/auth/register');
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', password);
    await page.fill('[name="fullName"]', 'Test User');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    const token = await page.evaluate(() =>
      localStorage.getItem('accessToken')
    );

    await use(token as string);
  },

  authenticatedPage: async ({ page, authToken }, use) => {
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('accessToken', token);
    }, authToken);

    await use(page);
  },
});

export { expect } from '@playwright/test';
```

### Contact Test Pattern

Reference: [tests/contacts.spec.ts](tests/contacts.spec.ts)

```typescript
import { test, expect } from '../fixtures/auth.fixture';

test.describe('Contact Management', () => {
  test('should create contact with all fields', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/contacts/new');

    await page.fill('[name="firstName"]', 'Jane');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="email"]', 'jane@example.com');
    await page.fill('[name="phone"]', '+1234567890');
    await page.fill('[name="company"]', 'Acme Corp');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/contacts\/[\w-]+/);
    await expect(page.locator('text=Jane Doe')).toBeVisible();
  });

  test('should validate required fields', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/contacts/new');
    await page.click('button[type="submit"]');

    await expect(
      page.locator('text=/first name.*required/i'),
    ).toBeVisible();
  });
});
```

### API Fixture Pattern

Reference: [fixtures/api.fixture.ts](fixtures/api.fixture.ts)

```typescript
import { test as base, APIRequestContext } from '@playwright/test';

type APIFixture = {
  apiContext: APIRequestContext;
};

export const test = base.extend<APIFixture>({
  apiContext: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: process.env.API_URL || 'http://localhost:3001/api/v1',
    });

    await use(context);
    await context.dispose();
  },
});
```

## Test Conventions

### File Naming

- Test files: `{feature}.spec.ts`
- Fixtures: `{name}.fixture.ts`

### Test Structure

```typescript
test.describe('Feature Name', () => {
  test.describe('Sub-feature', () => {
    test('should do something specific', async ({ authenticatedPage: page }) => {
      // Arrange
      await page.goto('/route');

      // Act
      await page.click('button:has-text("Action")');

      // Assert
      await expect(page.locator('text=Expected')).toBeVisible();
    });
  });
});
```

### Selectors

Prefer in order:
1. Test IDs: `[data-testid="contact-card"]`
2. Roles: `button:has-text("Submit")`
3. Labels: `[name="firstName"]`
4. Text: `text=John Doe`

### Waits

```typescript
// Wait for navigation
await page.waitForURL('/contacts');

// Wait for element
await expect(page.locator('text=Loading')).toBeVisible();

// Wait for element to disappear
await expect(page.locator('text=Loading')).not.toBeVisible();

// Wait for network idle
await page.waitForLoadState('networkidle');
```

## Playwright Configuration

Key settings in `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Accessibility Testing

Using `axe-playwright`:

```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test('should be accessible', async ({ page }) => {
  await page.goto('/contacts');
  await injectAxe(page);
  await checkA11y(page);
});
```

## Performance Testing

```typescript
test('should load contacts page within 3 seconds', async ({ page }) => {
  const start = Date.now();
  await page.goto('/contacts');
  await page.waitForSelector('[data-testid="contact-list"]');
  const loadTime = Date.now() - start;

  expect(loadTime).toBeLessThan(3000);
});
```

## Prerequisites

Before running E2E tests:
1. Backend running on port 3001
2. Frontend running on port 3000
3. Database with test data (or clean state)

```bash
# Start services
pnpm docker:up
pnpm dev

# In another terminal
pnpm test:e2e
```









