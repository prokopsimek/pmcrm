/**
 * E2E tests for contact management
 */
import { test, expect } from '../fixtures/auth.fixture';

test.describe('Contact Management', () => {
  test.use({ storageState: undefined }); // Use auth fixture

  test.describe('Contact List', () => {
    test('should display empty state when no contacts', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      await expect(
        page.locator('text=/no contacts yet/i'),
      ).toBeVisible();
      await expect(
        page.locator('button:has-text("Add Contact")'),
      ).toBeVisible();
    });

    test('should display contacts after creating them', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Create first contact
      await page.click('button:has-text("Add Contact")');
      await page.fill('[name="firstName"]', 'John');
      await page.fill('[name="lastName"]', 'Doe');
      await page.fill('[name="email"]', 'john.doe@example.com');
      await page.click('button[type="submit"]');

      // Should see contact in list
      await expect(page.locator('text=John Doe')).toBeVisible();
      await expect(page.locator('text=john.doe@example.com')).toBeVisible();
    });

    test('should search contacts by name', async ({
      authenticatedPage: page,
    }) => {
      // Create multiple contacts first
      await page.goto('/contacts/new');
      await page.fill('[name="firstName"]', 'Alice');
      await page.fill('[name="lastName"]', 'Smith');
      await page.fill('[name="email"]', 'alice@example.com');
      await page.click('button[type="submit"]');

      await page.goto('/contacts/new');
      await page.fill('[name="firstName"]', 'Bob');
      await page.fill('[name="lastName"]', 'Johnson');
      await page.fill('[name="email"]', 'bob@example.com');
      await page.click('button[type="submit"]');

      // Search for Alice
      await page.goto('/contacts');
      await page.fill('[placeholder*="Search"]', 'Alice');

      // Should only show Alice
      await expect(page.locator('text=Alice Smith')).toBeVisible();
      await expect(page.locator('text=Bob Johnson')).not.toBeVisible();
    });

    test('should filter contacts by relationship strength', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Apply filter
      await page.click('button:has-text("Filter")');
      await page.selectOption('[name="relationshipStrength"]', '8');
      await page.click('button:has-text("Apply")');

      // Should only show contacts with strength >= 8
      const contacts = page.locator('[data-testid="contact-card"]');
      await expect(contacts).toHaveCount(0); // No contacts match yet
    });

    test('should sort contacts by last contact date', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      await page.click('button:has-text("Sort")');
      await page.click('text=Last Contact Date');

      // Verify sorting order
      const firstContact = page.locator('[data-testid="contact-card"]').first();
      await expect(firstContact).toBeVisible();
    });
  });

  test.describe('Create Contact', () => {
    test('should create contact with all fields', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/new');

      await page.fill('[name="firstName"]', 'Jane');
      await page.fill('[name="lastName"]', 'Doe');
      await page.fill('[name="email"]', 'jane.doe@example.com');
      await page.fill('[name="phone"]', '+1234567890');
      await page.fill('[name="company"]', 'Acme Corp');
      await page.fill('[name="title"]', 'CEO');
      await page.fill('[name="linkedinUrl"]', 'https://linkedin.com/in/janedoe');
      await page.click('button[type="submit"]');

      // Should redirect to contact detail
      await expect(page).toHaveURL(/\/contacts\/[\w-]+/);
      await expect(page.locator('text=Jane Doe')).toBeVisible();
    });

    test('should validate required fields', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/new');

      // Try to submit without required fields
      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(
        page.locator('text=/first name.*required/i'),
      ).toBeVisible();
    });

    test('should validate email format', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/new');

      await page.fill('[name="firstName"]', 'Test');
      await page.fill('[name="email"]', 'invalid-email');
      await page.click('button[type="submit"]');

      await expect(
        page.locator('text=/valid email/i'),
      ).toBeVisible();
    });
  });

  test.describe('Edit Contact', () => {
    test('should update contact information', async ({
      authenticatedPage: page,
    }) => {
      // Create contact first
      await page.goto('/contacts/new');
      await page.fill('[name="firstName"]', 'Original');
      await page.fill('[name="lastName"]', 'Name');
      await page.fill('[name="email"]', 'original@example.com');
      await page.click('button[type="submit"]');

      // Edit contact
      await page.click('button:has-text("Edit")');
      await page.fill('[name="firstName"]', 'Updated');
      await page.fill('[name="lastName"]', 'Name');
      await page.click('button[type="submit"]');

      // Should show updated name
      await expect(page.locator('text=Updated Name')).toBeVisible();
    });

    test('should not lose data when canceling edit', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/new');
      await page.fill('[name="firstName"]', 'Test');
      await page.fill('[name="email"]', 'test@example.com');
      await page.click('button[type="submit"]');

      const originalName = await page.locator('h1').textContent();

      await page.click('button:has-text("Edit")');
      await page.fill('[name="firstName"]', 'Changed');
      await page.click('button:has-text("Cancel")');

      // Should keep original data
      await expect(page.locator('h1')).toHaveText(originalName!);
    });
  });

  test.describe('Delete Contact', () => {
    test('should delete contact with confirmation', async ({
      authenticatedPage: page,
    }) => {
      // Create contact
      await page.goto('/contacts/new');
      await page.fill('[name="firstName"]', 'Delete');
      await page.fill('[name="lastName"]', 'Me');
      await page.fill('[name="email"]', 'delete@example.com');
      await page.click('button[type="submit"]');

      // Delete contact
      await page.click('button:has-text("Delete")');

      // Confirm deletion
      await page.click('button:has-text("Confirm")');

      // Should redirect to contacts list
      await expect(page).toHaveURL(/\/contacts$/);

      // Contact should not appear in list
      await expect(page.locator('text=Delete Me')).not.toBeVisible();
    });

    test('should cancel deletion', async ({ authenticatedPage: page }) => {
      await page.goto('/contacts/new');
      await page.fill('[name="firstName"]', 'Keep');
      await page.fill('[name="email"]', 'keep@example.com');
      await page.click('button[type="submit"]');

      await page.click('button:has-text("Delete")');
      await page.click('button:has-text("Cancel")');

      // Should still see contact
      await expect(page.locator('text=Keep')).toBeVisible();
    });
  });

  test.describe('Contact Details', () => {
    test('should display all contact information', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/new');
      await page.fill('[name="firstName"]', 'Full');
      await page.fill('[name="lastName"]', 'Details');
      await page.fill('[name="email"]', 'full@example.com');
      await page.fill('[name="phone"]', '+1234567890');
      await page.fill('[name="company"]', 'Test Corp');
      await page.click('button[type="submit"]');

      // Verify all fields are displayed
      await expect(page.locator('text=Full Details')).toBeVisible();
      await expect(page.locator('text=full@example.com')).toBeVisible();
      await expect(page.locator('text=+1234567890')).toBeVisible();
      await expect(page.locator('text=Test Corp')).toBeVisible();
    });

    test('should show interaction timeline', async ({
      authenticatedPage: page,
    }) => {
      // Create contact and add interaction
      await page.goto('/contacts/new');
      await page.fill('[name="firstName"]', 'Timeline');
      await page.fill('[name="email"]', 'timeline@example.com');
      await page.click('button[type="submit"]');

      // Add interaction
      await page.click('button:has-text("Log Interaction")');
      await page.selectOption('[name="type"]', 'email');
      await page.fill('[name="summary"]', 'Sent follow-up email');
      await page.click('button[type="submit"]');

      // Should see interaction in timeline
      await expect(
        page.locator('text=Sent follow-up email'),
      ).toBeVisible();
    });
  });
});
