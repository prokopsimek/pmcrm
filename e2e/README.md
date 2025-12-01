# E2E Test Suite (Playwright)

End-to-end tests for the Personal Network CRM using Playwright.

## Structure

```
e2e/
├── playwright.config.ts         # Playwright configuration
├── fixtures/                    # Test fixtures
│   └── auth.fixture.ts         # Authentication fixtures
├── tests/                       # Test files
│   ├── auth.spec.ts
│   ├── contacts.spec.ts
│   └── gdpr.spec.ts
├── playwright-report/           # HTML test reports
└── test-results/               # Screenshots, videos, traces
```

## Running Tests

```bash
# Run all tests
npx playwright test

# Run specific file
npx playwright test auth.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run in debug mode
npx playwright test --debug

# Run on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run tests matching pattern
npx playwright test -g "login"

# Generate HTML report
npx playwright show-report
```

## Writing Tests

### Basic Test

```typescript
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Personal Network CRM/);
});
```

### Using Authentication Fixture

```typescript
import { test, expect } from '../fixtures/auth.fixture';

test('authenticated test', async ({ authenticatedPage: page }) => {
  // Already logged in
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/dashboard');
});
```

### Testing Forms

```typescript
test('submit contact form', async ({ page }) => {
  await page.goto('/contacts/new');

  // Fill form
  await page.fill('[name="firstName"]', 'John');
  await page.fill('[name="lastName"]', 'Doe');
  await page.fill('[name="email"]', 'john@example.com');

  // Submit
  await page.click('button[type="submit"]');

  // Verify redirect
  await expect(page).toHaveURL(/\/contacts\/[\w-]+/);

  // Verify content
  await expect(page.locator('text=John Doe')).toBeVisible();
});
```

### Testing Navigation

```typescript
test('navigate between pages', async ({ authenticatedPage: page }) => {
  await page.goto('/dashboard');

  // Click navigation link
  await page.click('nav >> text=Contacts');

  // Verify navigation
  await expect(page).toHaveURL('/contacts');
  await expect(page.locator('h1')).toHaveText('Contacts');
});
```

### Testing Interactions

```typescript
test('delete contact', async ({ authenticatedPage: page }) => {
  await page.goto('/contacts/contact-id');

  // Click delete button
  await page.click('button:has-text("Delete")');

  // Confirm dialog
  await page.click('button:has-text("Confirm")');

  // Verify redirect
  await expect(page).toHaveURL('/contacts');

  // Verify deletion
  await expect(page.locator('text=Contact deleted')).toBeVisible();
});
```

## Fixtures

### Authentication Fixture

Provides authenticated user session:

```typescript
import { test, expect } from '../fixtures/auth.fixture';

test('use authenticated page', async ({ authenticatedPage: page }) => {
  // User is already logged in
  await page.goto('/dashboard');
});
```

### Creating Custom Fixtures

```typescript
import { test as base } from '@playwright/test';

type MyFixture = {
  myFixture: string;
};

export const test = base.extend<MyFixture>({
  myFixture: async ({}, use) => {
    // Setup
    const value = 'test';

    await use(value);

    // Teardown
  },
});
```

## Selectors

### Best Practices

1. **Use data-testid** (most stable):
   ```typescript
   await page.click('[data-testid="submit-button"]');
   ```

2. **Use role** (semantic):
   ```typescript
   await page.click('button[role="submit"]');
   ```

3. **Use text** (readable):
   ```typescript
   await page.click('button:has-text("Submit")');
   ```

4. **Avoid CSS classes** (fragile):
   ```typescript
   // ❌ Avoid
   await page.click('.btn-primary');
   ```

### Locator Examples

```typescript
// By text
page.locator('text=Login');

// By role
page.locator('button[role="submit"]');

// By test ID
page.locator('[data-testid="user-menu"]');

// Combined
page.locator('button:has-text("Save")');

// CSS selector
page.locator('nav >> a');

// XPath
page.locator('xpath=//button[@type="submit"]');
```

## Assertions

```typescript
// URL
await expect(page).toHaveURL('/dashboard');
await expect(page).toHaveURL(/\/contacts\/[\w-]+/);

// Title
await expect(page).toHaveTitle('Dashboard');

// Visibility
await expect(page.locator('text=Welcome')).toBeVisible();
await expect(page.locator('text=Loading')).not.toBeVisible();

// Text content
await expect(page.locator('h1')).toHaveText('Dashboard');
await expect(page.locator('.error')).toContainText('Invalid');

// Count
await expect(page.locator('.contact-card')).toHaveCount(5);

// Attributes
await expect(page.locator('input')).toHaveAttribute('disabled');
await expect(page.locator('a')).toHaveAttribute('href', '/dashboard');

// State
await expect(page.locator('input')).toBeEnabled();
await expect(page.locator('input')).toBeDisabled();
await expect(page.locator('checkbox')).toBeChecked();
```

## Waiting

```typescript
// Wait for navigation
await page.waitForURL('/dashboard');

// Wait for selector
await page.waitForSelector('[data-testid="contact-list"]');

// Wait for load state
await page.waitForLoadState('networkidle');

// Wait for response
await page.waitForResponse(/api\/contacts/);

// Wait for timeout
await page.waitForTimeout(1000); // Use sparingly!

// Auto-waiting (preferred)
await expect(page.locator('text=Loaded')).toBeVisible();
```

## Screenshots and Videos

```typescript
// Take screenshot
await page.screenshot({ path: 'screenshot.png' });

// Screenshot on failure (automatic)
// Configured in playwright.config.ts

// Record video (automatic)
// Configured in playwright.config.ts

// Trace on retry (automatic)
// Configured in playwright.config.ts
```

## Debugging

### Visual Debugger

```bash
# Open Playwright Inspector
npx playwright test --debug

# Debug specific test
npx playwright test auth.spec.ts --debug
```

### Headed Mode

```bash
# See browser while running
npx playwright test --headed

# Slow down actions
npx playwright test --headed --slow-mo=1000
```

### Pause Execution

```typescript
test('debug test', async ({ page }) => {
  await page.goto('/');

  // Pause execution
  await page.pause();

  // Continue manually in inspector
});
```

### Console Logs

```typescript
test('see logs', async ({ page }) => {
  // Listen to console
  page.on('console', msg => console.log(msg.text()));

  await page.goto('/');
});
```

## Configuration

### playwright.config.ts

```typescript
export default defineConfig({
  // Test directory
  testDir: './tests',

  // Base URL
  use: {
    baseURL: 'http://localhost:3000',
  },

  // Projects (browsers)
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],

  // Start dev server
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
  },
});
```

## Best Practices

1. **Use Page Object Model** for complex pages
2. **Use fixtures** for common setup
3. **Test user journeys** not just features
4. **Use semantic selectors** (role, label)
5. **Wait automatically** with expect
6. **Keep tests independent** - no test order dependencies
7. **Clean up state** between tests
8. **Test critical paths** thoroughly
9. **Use realistic data** in tests
10. **Run in CI** on every PR

## CI Integration

Tests run automatically in GitHub Actions:

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npx playwright test

- name: Upload report
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: playwright-report
    path: e2e/playwright-report
```

## Troubleshooting

### Flaky Tests

```typescript
// Use retry-able assertions
await expect(async () => {
  const count = await page.locator('.item').count();
  expect(count).toBe(5);
}).toPass({ timeout: 5000 });

// Wait for specific state
await page.waitForLoadState('networkidle');

// Use auto-waiting assertions
await expect(page.locator('text=Loaded')).toBeVisible();
```

### Timeouts

```typescript
// Increase timeout for slow operations
test('slow test', async ({ page }) => {
  await page.goto('/', { timeout: 30000 });
});

// Global timeout in config
export default defineConfig({
  timeout: 30000,
});
```

### Element Not Found

```typescript
// Check if visible
await expect(page.locator('button')).toBeVisible();

// Wait for element
await page.waitForSelector('button');

// Use better selector
await page.click('[data-testid="submit-button"]');
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
