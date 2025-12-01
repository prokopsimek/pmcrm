/**
 * E2E tests for US-012: Manual Contact Creation
 * Tests creating contacts manually with full form validation
 */
import { test, expect } from '../fixtures/auth.fixture';

test.describe('Manual Contact Creation (US-012)', () => {
  test.describe('Create Contact Form', () => {
    test('should create contact with basic information', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/new');

      // Fill basic information
      await page.fill('[name="firstName"]', 'Jane');
      await page.fill('[name="lastName"]', 'Doe');
      await page.fill('[name="email"]', 'jane.doe@example.com');
      await page.fill('[name="phone"]', '+1234567890');

      // Submit form
      await page.click('button[type="submit"]');

      // Should redirect to contact detail page
      await expect(page).toHaveURL(/\/contacts\/[\w-]+/);

      // Verify contact details are displayed
      await expect(page.locator('h1')).toContainText('Jane Doe');
      await expect(page.locator('text=jane.doe@example.com')).toBeVisible();
      await expect(page.locator('text=+1234567890')).toBeVisible();
    });

    test('should create contact with all fields', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/new');

      // Basic info
      await page.fill('[name="firstName"]', 'John');
      await page.fill('[name="lastName"]', 'Smith');
      await page.fill('[name="nickname"]', 'Johnny');
      await page.fill('[name="email"]', 'john.smith@example.com');
      await page.fill('[name="phone"]', '+1234567890');
      await page.fill('[name="secondaryEmail"]', 'john.personal@example.com');
      await page.fill('[name="secondaryPhone"]', '+0987654321');

      // Social & Professional
      await page.fill('[name="linkedinUrl"]', 'https://linkedin.com/in/johnsmith');
      await page.fill('[name="twitterHandle"]', '@johnsmith');
      await page.fill('[name="website"]', 'https://johnsmith.com');
      await page.fill('[name="company"]', 'Acme Corp');
      await page.fill('[name="title"]', 'CEO');

      // Address
      await page.fill('[name="street"]', '123 Main St');
      await page.fill('[name="city"]', 'San Francisco');
      await page.fill('[name="state"]', 'CA');
      await page.fill('[name="country"]', 'USA');
      await page.fill('[name="postalCode"]', '94102');

      // Personal info
      await page.fill('[name="birthday"]', '1990-05-15');
      await page.fill('[name="notes"]', 'Met at tech conference 2023');

      // Relationship
      await page.selectOption('[name="relationshipTier"]', 'VIP');
      await page.fill('[name="relationshipStrength"]', '8');

      // Submit
      await page.click('button[type="submit"]');

      // Verify all fields on detail page
      await expect(page).toHaveURL(/\/contacts\/[\w-]+/);
      await expect(page.locator('text=Johnny')).toBeVisible();
      await expect(page.locator('text=Acme Corp')).toBeVisible();
      await expect(page.locator('text=CEO')).toBeVisible();
      await expect(page.locator('text=San Francisco, CA')).toBeVisible();
    });

    test('should validate required fields', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/new');

      // Try to submit without required fields
      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(page.locator('text=/first name.*required/i')).toBeVisible();
    });

    test('should validate email format', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/new');

      await page.fill('[name="firstName"]', 'Test');
      await page.fill('[name="email"]', 'invalid-email');
      await page.click('button[type="submit"]');

      // Should show email validation error
      await expect(page.locator('text=/valid email/i')).toBeVisible();
    });

    test('should validate phone format', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/new');

      await page.fill('[name="firstName"]', 'Test');
      await page.fill('[name="phone"]', '12345'); // Invalid phone
      await page.click('button[type="submit"]');

      // Should show phone validation error
      await expect(page.locator('text=/valid phone/i')).toBeVisible();
    });

    test('should validate URL format for LinkedIn', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/new');

      await page.fill('[name="firstName"]', 'Test');
      await page.fill('[name="linkedinUrl"]', 'not-a-url');
      await page.click('button[type="submit"]');

      // Should show URL validation error
      await expect(page.locator('text=/valid URL/i')).toBeVisible();
    });
  });

  test.describe('Edit Contact', () => {
    test('should update existing contact', async ({
      authenticatedPage: page,
    }) => {
      // First, create a contact
      await page.goto('/contacts/new');
      await page.fill('[name="firstName"]', 'Original');
      await page.fill('[name="lastName"]', 'Name');
      await page.fill('[name="email"]', 'original@example.com');
      await page.click('button[type="submit"]');

      // Wait for redirect
      await page.waitForURL(/\/contacts\/[\w-]+/);

      // Click edit button
      await page.click('button:has-text("Edit")');

      // Update fields
      await page.fill('[name="firstName"]', 'Updated');
      await page.fill('[name="phone"]', '+1111111111');
      await page.fill('[name="company"]', 'New Company');

      // Save changes
      await page.click('button:has-text("Save")');

      // Verify updates
      await expect(page.locator('h1')).toContainText('Updated Name');
      await expect(page.locator('text=+1111111111')).toBeVisible();
      await expect(page.locator('text=New Company')).toBeVisible();
    });

    test('should cancel edit without saving', async ({
      authenticatedPage: page,
    }) => {
      // Create contact
      await page.goto('/contacts/new');
      await page.fill('[name="firstName"]', 'Original');
      await page.fill('[name="email"]', 'original@example.com');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/contacts\/[\w-]+/);

      // Start editing
      await page.click('button:has-text("Edit")');
      await page.fill('[name="firstName"]', 'Changed');

      // Cancel
      await page.click('button:has-text("Cancel")');

      // Verify original data unchanged
      await expect(page.locator('h1')).toContainText('Original');
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

      await page.waitForURL(/\/contacts\/[\w-]+/);

      // Delete contact
      await page.click('button:has-text("Delete")');

      // Confirm deletion in modal
      await expect(page.locator('text=/are you sure/i')).toBeVisible();
      await page.click('button:has-text("Confirm")');

      // Should redirect to contacts list
      await expect(page).toHaveURL(/\/contacts$/);

      // Verify contact not in list
      await expect(page.locator('text=Delete Me')).not.toBeVisible();
    });

    test('should cancel deletion', async ({
      authenticatedPage: page,
    }) => {
      // Create contact
      await page.goto('/contacts/new');
      await page.fill('[name="firstName"]', 'Keep');
      await page.fill('[name="email"]', 'keep@example.com');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/contacts\/[\w-]+/);

      // Try to delete
      await page.click('button:has-text("Delete")');

      // Cancel
      await page.click('button:has-text("Cancel")');

      // Verify still on contact page
      await expect(page.locator('text=Keep')).toBeVisible();
    });
  });

  test.describe('Quick Add from Various Pages', () => {
    test('should add contact from dashboard quick action', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/dashboard');

      // Click quick add button
      await page.click('[data-testid="quick-add-contact"]');

      // Should open modal or inline form
      await expect(page.locator('[data-testid="quick-add-form"]')).toBeVisible();

      // Fill minimum required fields
      await page.fill('[data-testid="quick-add-form"] [name="firstName"]', 'Quick');
      await page.fill('[data-testid="quick-add-form"] [name="email"]', 'quick@example.com');

      // Submit
      await page.click('[data-testid="quick-add-form"] button[type="submit"]');

      // Should show success message
      await expect(page.locator('text=/contact added/i')).toBeVisible();
    });

    test('should add contact from floating action button', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Click FAB
      await page.click('[data-testid="fab-add-contact"]');

      // Should navigate to new contact page
      await expect(page).toHaveURL(/\/contacts\/new/);
    });
  });

  test.describe('Contact List Management', () => {
    test('should display contacts in list view', async ({
      authenticatedPage: page,
    }) => {
      // Create multiple contacts
      const contacts = [
        { firstName: 'Alice', email: 'alice@example.com' },
        { firstName: 'Bob', email: 'bob@example.com' },
        { firstName: 'Charlie', email: 'charlie@example.com' },
      ];

      for (const contact of contacts) {
        await page.goto('/contacts/new');
        await page.fill('[name="firstName"]', contact.firstName);
        await page.fill('[name="email"]', contact.email);
        await page.click('button[type="submit"]');
      }

      // Go to contacts list
      await page.goto('/contacts');

      // Verify all contacts are displayed
      for (const contact of contacts) {
        await expect(page.locator(`text=${contact.firstName}`)).toBeVisible();
      }
    });

    test('should switch between list and grid view', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Default should be list view
      await expect(page.locator('[data-testid="contact-list-view"]')).toBeVisible();

      // Switch to grid
      await page.click('[data-testid="view-toggle-grid"]');
      await expect(page.locator('[data-testid="contact-grid-view"]')).toBeVisible();

      // Switch back to list
      await page.click('[data-testid="view-toggle-list"]');
      await expect(page.locator('[data-testid="contact-list-view"]')).toBeVisible();
    });

    test('should sort contacts by name', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Click sort by name
      await page.click('[data-testid="sort-by-name"]');

      // Verify alphabetical order
      const contactNames = await page.locator('[data-testid="contact-name"]').allTextContents();
      const sorted = [...contactNames].sort();
      expect(contactNames).toEqual(sorted);
    });

    test('should filter contacts by relationship tier', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Apply filter
      await page.click('[data-testid="filter-button"]');
      await page.click('[data-testid="filter-vip"]');
      await page.click('button:has-text("Apply")');

      // Verify URL has filter param
      await expect(page).toHaveURL(/tier=VIP/);

      // Verify only VIP contacts shown
      const tierBadges = await page.locator('[data-testid="tier-badge"]').allTextContents();
      for (const badge of tierBadges) {
        expect(badge).toContain('VIP');
      }
    });
  });

  test.describe('Bulk Operations', () => {
    test('should select multiple contacts', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Select first 3 contacts
      const checkboxes = page.locator('[data-testid="contact-checkbox"]');
      for (let i = 0; i < 3; i++) {
        await checkboxes.nth(i).check();
      }

      // Verify selection count
      await expect(page.locator('text=3 selected')).toBeVisible();
    });

    test('should bulk delete contacts', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Select contacts
      await page.click('[data-testid="select-all"]');

      // Bulk delete
      await page.click('button:has-text("Delete Selected")');

      // Confirm
      await page.click('button:has-text("Confirm")');

      // Should show success message
      await expect(page.locator('text=/contacts deleted/i')).toBeVisible();
    });

    test('should bulk add tags', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Select contacts
      const checkboxes = page.locator('[data-testid="contact-checkbox"]');
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();

      // Bulk tag
      await page.click('button:has-text("Add Tags")');
      await page.fill('[placeholder="Enter tag name"]', 'Important');
      await page.press('[placeholder="Enter tag name"]', 'Enter');

      // Verify tags applied
      await expect(page.locator('text=Tags added successfully')).toBeVisible();
    });
  });
});
