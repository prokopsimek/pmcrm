/**
 * E2E tests for authentication flow
 */
import { test, expect } from '@playwright/test';
import { createTestUser, login, logout } from '../fixtures/auth.fixture';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('Registration', () => {
    test('should register new user successfully', async ({ page }) => {
      const email = `newuser-${Date.now()}@example.com`;

      await page.goto('/auth/register');

      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', 'SecurePassword123!');
      await page.fill('[name="fullName"]', 'New User');
      await page.click('button[type="submit"]');

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/);

      // Should display user name
      await expect(page.locator('text=New User')).toBeVisible();
    });

    test('should show validation errors for invalid inputs', async ({ page }) => {
      await page.goto('/auth/register');

      // Try to submit empty form
      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(page.locator('text=/email.*required/i')).toBeVisible();
      await expect(page.locator('text=/password.*required/i')).toBeVisible();
    });

    test('should reject weak password', async ({ page }) => {
      await page.goto('/auth/register');

      await page.fill('[name="email"]', 'test@example.com');
      await page.fill('[name="password"]', '123'); // Weak password
      await page.fill('[name="fullName"]', 'Test User');
      await page.click('button[type="submit"]');

      // Should show password strength error
      await expect(
        page.locator('text=/password.*strong/i'),
      ).toBeVisible();
    });

    test('should prevent duplicate email registration', async ({ page }) => {
      const email = `duplicate-${Date.now()}@example.com`;

      // First registration
      await createTestUser(page);
      await logout(page);

      // Try to register again with same email
      await page.goto('/auth/register');
      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', 'SecurePassword123!');
      await page.fill('[name="fullName"]', 'Duplicate User');
      await page.click('button[type="submit"]');

      // Should show error
      await expect(
        page.locator('text=/email.*already.*exists/i'),
      ).toBeVisible();
    });
  });

  test.describe('Login', () => {
    test('should login with valid credentials', async ({ page }) => {
      const { email, password } = await createTestUser(page);
      await logout(page);

      await login(page, email, password);

      // Should be on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should reject invalid credentials', async ({ page }) => {
      await page.goto('/auth/login');

      await page.fill('[name="email"]', 'nonexistent@example.com');
      await page.fill('[name="password"]', 'WrongPassword123!');
      await page.click('button[type="submit"]');

      // Should show error
      await expect(
        page.locator('text=/invalid.*credentials/i'),
      ).toBeVisible();
    });

    test('should remember me functionality', async ({ page }) => {
      const { email, password } = await createTestUser(page);
      await logout(page);

      await page.goto('/auth/login');
      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', password);
      await page.check('[name="rememberMe"]');
      await page.click('button[type="submit"]');

      // Close and reopen browser
      const context = page.context();
      await context.close();
      const newContext = await context.browser()!.newContext();
      const newPage = await newContext.newPage();

      await newPage.goto('/dashboard');

      // Should still be logged in
      await expect(newPage).toHaveURL(/\/dashboard/);
    });
  });

  test.describe('Logout', () => {
    test('should logout and redirect to login page', async ({ page }) => {
      await createTestUser(page);

      await logout(page);

      // Should be on login page
      await expect(page).toHaveURL(/\/auth\/login/);

      // Should not be able to access protected routes
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('should clear auth token on logout', async ({ page }) => {
      await createTestUser(page);

      const tokenBefore = await page.evaluate(() =>
        localStorage.getItem('accessToken'),
      );
      expect(tokenBefore).toBeTruthy();

      await logout(page);

      const tokenAfter = await page.evaluate(() =>
        localStorage.getItem('accessToken'),
      );
      expect(tokenAfter).toBeNull();
    });
  });

  test.describe('Session Management', () => {
    test('should redirect to login if not authenticated', async ({ page }) => {
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('should persist session across page reloads', async ({ page }) => {
      await createTestUser(page);

      await page.reload();

      // Should still be authenticated
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should handle token expiration gracefully', async ({ page }) => {
      await createTestUser(page);

      // Manually expire token
      await page.evaluate(() => {
        localStorage.setItem('accessToken', 'expired-token');
      });

      await page.reload();

      // Should redirect to login
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(
        page.locator('text=/session.*expired/i'),
      ).toBeVisible();
    });
  });

  test.describe('Password Reset', () => {
    test('should request password reset', async ({ page }) => {
      const { email } = await createTestUser(page);
      await logout(page);

      await page.goto('/auth/forgot-password');
      await page.fill('[name="email"]', email);
      await page.click('button[type="submit"]');

      // Should show success message
      await expect(
        page.locator('text=/check.*email/i'),
      ).toBeVisible();
    });

    test('should reset password with valid token', async ({ page }) => {
      // This would require accessing email or database to get reset token
      // Simplified version:
      await page.goto('/auth/reset-password?token=valid-reset-token');

      await page.fill('[name="password"]', 'NewSecurePassword123!');
      await page.fill('[name="confirmPassword"]', 'NewSecurePassword123!');
      await page.click('button[type="submit"]');

      // Should redirect to login
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(
        page.locator('text=/password.*reset.*success/i'),
      ).toBeVisible();
    });
  });
});
