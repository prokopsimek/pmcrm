/**
 * Playwright fixture for authenticated user sessions
 */
import { test as base } from '@playwright/test';
import { Page } from '@playwright/test';

type AuthFixture = {
  authenticatedPage: Page;
  authToken: string;
};

/**
 * Extend base test with authentication fixture
 */
export const test = base.extend<AuthFixture>({
  authToken: async ({ page }, use) => {
    // Register and login to get auth token
    const email = `test-${Date.now()}@example.com`;
    const password = 'SecurePassword123!';

    await page.goto('/auth/register');
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', password);
    await page.fill('[name="fullName"]', 'Test User');
    await page.click('button[type="submit"]');

    // Wait for redirect after successful registration
    await page.waitForURL('/dashboard');

    // Extract token from localStorage or cookies
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));

    await use(token as string);

    // Cleanup: logout after test
    await page.goto('/auth/logout');
  },

  authenticatedPage: async ({ page, authToken }, use) => {
    // Set auth token in storage before navigating
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('accessToken', token);
    }, authToken);

    await use(page);
  },
});

/**
 * Helper to create a test user and return credentials
 */
export async function createTestUser(page: Page) {
  const email = `test-${Date.now()}@example.com`;
  const password = 'SecurePassword123!';
  const fullName = 'Test User';

  await page.goto('/auth/register');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.fill('[name="fullName"]', fullName);
  await page.click('button[type="submit"]');

  await page.waitForURL('/dashboard');

  return { email, password, fullName };
}

/**
 * Helper to login with existing credentials
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL('/dashboard');
}

/**
 * Helper to logout
 */
export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('text=Logout');
  await page.waitForURL('/auth/login');
}

export { expect } from '@playwright/test';
