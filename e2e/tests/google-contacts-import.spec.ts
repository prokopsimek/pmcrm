/**
 * E2E tests for US-010: Google Contacts Import
 * Tests the complete flow from OAuth to contact import with deduplication
 */
import { test, expect } from '../fixtures/auth.fixture';

test.describe('Google Contacts Import (US-010)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('OAuth Connection Flow', () => {
    test('should connect Google account via OAuth', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/settings/integrations');

      // Click Google Contacts integration
      await page.click('button:has-text("Connect Google Contacts")');

      // Mock OAuth popup - In real scenario, this would open OAuth consent screen
      // For E2E tests, we can mock the OAuth callback
      await page.route('**/api/v1/integrations/google/oauth/callback**', async (route) => {
        await route.fulfill({
          status: 302,
          headers: {
            Location: '/settings/integrations?google_connected=true',
          },
        });
      });

      // Wait for redirect after OAuth
      await page.waitForURL(/\/settings\/integrations/);

      // Verify connection status
      await expect(
        page.locator('text=Google Contacts Connected')
      ).toBeVisible();
    });

    test('should handle OAuth cancellation gracefully', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/settings/integrations');

      await page.click('button:has-text("Connect Google Contacts")');

      // Mock OAuth cancellation
      await page.route('**/api/v1/integrations/google/oauth/callback**', async (route) => {
        await route.fulfill({
          status: 302,
          headers: {
            Location: '/settings/integrations?error=access_denied',
          },
        });
      });

      // Should show error message
      await expect(
        page.locator('text=/connection cancelled/i')
      ).toBeVisible();
    });

    test('should handle OAuth errors', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/settings/integrations');

      await page.click('button:has-text("Connect Google Contacts")');

      // Mock OAuth error
      await page.route('**/api/v1/integrations/google/oauth/callback**', async (route) => {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'OAuth provider error' }),
        });
      });

      // Should show error message
      await expect(
        page.locator('text=/something went wrong/i')
      ).toBeVisible();
    });
  });

  test.describe('Contact Preview & Selection', () => {
    test('should display contact preview after OAuth', async ({
      authenticatedPage: page,
    }) => {
      // Assume Google is already connected
      await page.goto('/integrations/google/import');

      // Mock Google Contacts API response
      await page.route('**/api/v1/integrations/google/contacts/preview**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            contacts: [
              {
                id: 'google-1',
                firstName: 'Alice',
                lastName: 'Johnson',
                email: 'alice@example.com',
                phone: '+1234567890',
              },
              {
                id: 'google-2',
                firstName: 'Bob',
                lastName: 'Smith',
                email: 'bob@example.com',
                phone: '+0987654321',
              },
              {
                id: 'google-3',
                firstName: 'Charlie',
                lastName: 'Brown',
                email: 'charlie@example.com',
              },
            ],
            total: 3,
          }),
        });
      });

      // Load preview
      await page.click('button:has-text("Preview Contacts")');

      // Wait for contacts to load
      await expect(page.locator('[data-testid="contact-preview-item"]')).toHaveCount(3);

      // Verify contact details are displayed
      await expect(page.locator('text=Alice Johnson')).toBeVisible();
      await expect(page.locator('text=alice@example.com')).toBeVisible();
    });

    test('should allow selecting/deselecting contacts', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/integrations/google/import');

      // Select all contacts
      await page.click('[data-testid="select-all-contacts"]');
      const allCheckboxes = page.locator('[data-testid="contact-checkbox"]');
      await expect(allCheckboxes).toHaveCount(3);

      for (let i = 0; i < 3; i++) {
        await expect(allCheckboxes.nth(i)).toBeChecked();
      }

      // Deselect one contact
      await allCheckboxes.nth(1).uncheck();
      await expect(allCheckboxes.nth(1)).not.toBeChecked();

      // Verify selection count
      await expect(page.locator('text=2 of 3 selected')).toBeVisible();
    });

    test('should filter contacts by search', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/integrations/google/import');

      // Search for specific contact
      await page.fill('[placeholder="Search contacts"]', 'Alice');

      // Should only show matching contacts
      await expect(page.locator('text=Alice Johnson')).toBeVisible();
      await expect(page.locator('text=Bob Smith')).not.toBeVisible();
    });

    test('should handle large contact lists with pagination', async ({
      authenticatedPage: page,
    }) => {
      // Mock API with 50 contacts
      await page.route('**/api/v1/integrations/google/contacts/preview**', async (route) => {
        const url = new URL(route.request().url());
        const page = parseInt(url.searchParams.get('page') || '1');
        const perPage = 20;

        const contacts = Array.from({ length: 50 }, (_, i) => ({
          id: `google-${i + 1}`,
          firstName: `Contact`,
          lastName: `${i + 1}`,
          email: `contact${i + 1}@example.com`,
        }));

        const start = (page - 1) * perPage;
        const end = start + perPage;

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            contacts: contacts.slice(start, end),
            total: 50,
            page,
            perPage,
          }),
        });
      });

      await page.goto('/integrations/google/import');

      // Verify first page
      await expect(page.locator('[data-testid="contact-preview-item"]')).toHaveCount(20);

      // Go to next page
      await page.click('button:has-text("Next")');

      // Verify second page loaded
      await expect(page.locator('text=Contact 21')).toBeVisible();
    });
  });

  test.describe('Deduplication Flow', () => {
    test('should detect duplicate contacts by email', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/integrations/google/import/deduplicate');

      // Mock deduplication API response
      await page.route('**/api/v1/integrations/google/contacts/deduplicate**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            duplicates: [
              {
                googleContact: {
                  id: 'google-dup-1',
                  firstName: 'Alice',
                  lastName: 'Johnson',
                  email: 'alice@example.com',
                },
                existingContact: {
                  id: 'existing-1',
                  firstName: 'Alice',
                  lastName: 'J.',
                  email: 'alice@example.com',
                },
                matchScore: 95,
              },
            ],
          }),
        });
      });

      await page.click('button:has-text("Check for Duplicates")');

      // Should show duplicate match
      await expect(
        page.locator('text=1 potential duplicate found')
      ).toBeVisible();
      await expect(page.locator('text=95% match')).toBeVisible();
    });

    test('should allow choosing deduplication strategy', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/integrations/google/import/deduplicate');

      // Find duplicate entry
      const duplicateCard = page.locator('[data-testid="duplicate-card"]').first();

      // Select "Keep both" option
      await duplicateCard.locator('select[name="strategy"]').selectOption('keep_both');

      // Verify selection
      const selectedValue = await duplicateCard.locator('select[name="strategy"]').inputValue();
      expect(selectedValue).toBe('keep_both');

      // Try "Merge" option
      await duplicateCard.locator('select[name="strategy"]').selectOption('merge');

      // Should show merge options
      await expect(
        duplicateCard.locator('text=Choose which fields to keep')
      ).toBeVisible();
    });

    test('should preview merged contact data', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/integrations/google/import/deduplicate');

      const duplicateCard = page.locator('[data-testid="duplicate-card"]').first();

      // Select merge strategy
      await duplicateCard.locator('select[name="strategy"]').selectOption('merge');

      // Preview merged data
      await duplicateCard.click('button:has-text("Preview Merge")');

      // Should show preview modal
      await expect(page.locator('[data-testid="merge-preview-modal"]')).toBeVisible();

      // Should show merged fields
      await expect(page.locator('text=firstName: Alice')).toBeVisible();
      await expect(page.locator('text=email: alice@example.com')).toBeVisible();
    });
  });

  test.describe('Tag Mapping & Import Execution', () => {
    test('should map Google contact groups to tags', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/integrations/google/import/tags');

      // Mock Google groups
      await page.route('**/api/v1/integrations/google/groups**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            groups: [
              { id: 'group-1', name: 'Family' },
              { id: 'group-2', name: 'Colleagues' },
              { id: 'group-3', name: 'Friends' },
            ],
          }),
        });
      });

      await page.click('button:has-text("Load Groups")');

      // Map groups to tags
      await expect(page.locator('text=Family')).toBeVisible();

      // Create new tag for mapping
      const familyRow = page.locator('[data-testid="group-row"]').filter({ hasText: 'Family' });
      await familyRow.locator('select[name="tagMapping"]').selectOption('create_new');
      await familyRow.locator('input[name="newTagName"]').fill('Family Members');

      // Verify mapping
      const mappingValue = await familyRow.locator('input[name="newTagName"]').inputValue();
      expect(mappingValue).toBe('Family Members');
    });

    test('should execute import with selected options', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/integrations/google/import/confirm');

      // Review import summary
      await expect(page.locator('text=/importing.*contacts/i')).toBeVisible();

      // Mock import API
      await page.route('**/api/v1/integrations/google/contacts/import**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            imported: 3,
            skipped: 0,
            merged: 1,
            errors: 0,
          }),
        });
      });

      // Execute import
      await page.click('button:has-text("Import Contacts")');

      // Should show progress
      await expect(page.locator('[data-testid="import-progress"]')).toBeVisible();

      // Wait for completion
      await expect(
        page.locator('text=Import Complete'),
        { timeout: 10000 }
      ).toBeVisible();

      // Verify import summary
      await expect(page.locator('text=3 contacts imported')).toBeVisible();
      await expect(page.locator('text=1 contact merged')).toBeVisible();
    });

    test('should handle import errors gracefully', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/integrations/google/import/confirm');

      // Mock import error
      await page.route('**/api/v1/integrations/google/contacts/import**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Import failed due to database error',
          }),
        });
      });

      await page.click('button:has-text("Import Contacts")');

      // Should show error message
      await expect(
        page.locator('text=/import failed/i')
      ).toBeVisible();

      // Should allow retry
      await expect(
        page.locator('button:has-text("Retry Import")')
      ).toBeVisible();
    });
  });

  test.describe('Complete Import Journey', () => {
    test('should complete full Google Contacts import flow', async ({
      authenticatedPage: page,
    }) => {
      // 1. Connect Google account
      await page.goto('/settings/integrations');
      await page.click('button:has-text("Connect Google Contacts")');

      // Mock successful OAuth
      await page.route('**/api/v1/integrations/google/oauth/callback**', async (route) => {
        await route.fulfill({
          status: 302,
          headers: { Location: '/integrations/google/import' },
        });
      });

      // 2. Preview contacts
      await page.waitForURL(/\/integrations\/google\/import/);

      // Mock contacts
      await page.route('**/api/v1/integrations/google/contacts/preview**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            contacts: [
              { id: 'g1', firstName: 'Alice', email: 'alice@example.com' },
              { id: 'g2', firstName: 'Bob', email: 'bob@example.com' },
            ],
            total: 2,
          }),
        });
      });

      await page.click('button:has-text("Load Contacts")');
      await expect(page.locator('[data-testid="contact-preview-item"]')).toHaveCount(2);

      // 3. Select contacts
      await page.click('[data-testid="select-all-contacts"]');
      await page.click('button:has-text("Next")');

      // 4. Check for duplicates
      await page.route('**/api/v1/integrations/google/contacts/deduplicate**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ duplicates: [] }),
        });
      });

      await page.click('button:has-text("Check Duplicates")');
      await expect(page.locator('text=No duplicates found')).toBeVisible();
      await page.click('button:has-text("Next")');

      // 5. Skip tag mapping
      await page.click('button:has-text("Skip")');

      // 6. Import contacts
      await page.route('**/api/v1/integrations/google/contacts/import**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            imported: 2,
            skipped: 0,
            merged: 0,
            errors: 0,
          }),
        });
      });

      await page.click('button:has-text("Import Contacts")');

      // 7. Verify completion
      await expect(page.locator('text=Import Complete')).toBeVisible();
      await expect(page.locator('text=2 contacts imported')).toBeVisible();

      // 8. Verify redirect to contacts page
      await page.click('button:has-text("View Contacts")');
      await expect(page).toHaveURL(/\/contacts/);

      // 9. Verify imported contacts are visible
      await expect(page.locator('text=Alice')).toBeVisible();
      await expect(page.locator('text=Bob')).toBeVisible();
    });
  });
});
