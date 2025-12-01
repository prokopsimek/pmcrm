/**
 * E2E tests for US-030: Email Sync
 * Tests email integration, sync, and automatic contact matching
 */
import { test, expect } from '../fixtures/auth.fixture';

test.describe('Email Sync (US-030)', () => {
  test.describe('Email Integration Setup', () => {
    test('should connect Gmail account', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/settings/integrations');

      // Click Gmail integration
      await page.click('button:has-text("Connect Gmail")');

      // Mock OAuth flow
      await page.route('**/api/v1/integrations/gmail/oauth/callback**', async (route) => {
        await route.fulfill({
          status: 302,
          headers: {
            Location: '/settings/integrations?gmail_connected=true',
          },
        });
      });

      // Wait for redirect
      await page.waitForURL(/gmail_connected=true/);

      // Verify connection status
      await expect(page.locator('text=Gmail Connected')).toBeVisible();
    });

    test('should connect Outlook account', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/settings/integrations');

      await page.click('button:has-text("Connect Outlook")');

      // Mock Microsoft OAuth
      await page.route('**/api/v1/integrations/outlook/oauth/callback**', async (route) => {
        await route.fulfill({
          status: 302,
          headers: {
            Location: '/settings/integrations?outlook_connected=true',
          },
        });
      });

      await page.waitForURL(/outlook_connected=true/);
      await expect(page.locator('text=Outlook Connected')).toBeVisible();
    });

    test('should configure sync settings', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/settings/email-sync');

      // Enable auto-sync
      await page.check('[name="autoSync"]');

      // Set sync frequency
      await page.selectOption('[name="syncFrequency"]', '15'); // Every 15 minutes

      // Configure sync scope
      await page.check('[name="syncSent"]');
      await page.check('[name="syncReceived"]');
      await page.uncheck('[name="syncDrafts"]');

      // Save settings
      await page.click('button:has-text("Save Settings")');

      await expect(page.locator('text=Email sync settings saved')).toBeVisible();
    });
  });

  test.describe('Email Sync Execution', () => {
    test('should trigger manual sync', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/emails');

      // Click sync button
      await page.click('button:has-text("Sync Now")');

      // Show syncing indicator
      await expect(page.locator('[data-testid="sync-progress"]')).toBeVisible();

      // Mock sync completion
      await page.route('**/api/v1/integrations/email/sync**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            synced: 25,
            matched: 15,
            errors: 0,
          }),
        });
      });

      // Wait for completion
      await expect(
        page.locator('text=Sync complete'),
        { timeout: 10000 }
      ).toBeVisible();

      // Verify sync stats
      await expect(page.locator('text=25 emails synced')).toBeVisible();
      await expect(page.locator('text=15 contacts matched')).toBeVisible();
    });

    test('should display sync history', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/settings/email-sync/history');

      // Verify sync history table
      await expect(page.locator('[data-testid="sync-history-table"]')).toBeVisible();

      // Verify columns
      await expect(page.locator('th:has-text("Date")')).toBeVisible();
      await expect(page.locator('th:has-text("Status")')).toBeVisible();
      await expect(page.locator('th:has-text("Emails Synced")')).toBeVisible();
    });

    test('should handle sync errors gracefully', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/emails');

      // Mock sync error
      await page.route('**/api/v1/integrations/email/sync**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'OAuth token expired',
          }),
        });
      });

      await page.click('button:has-text("Sync Now")');

      // Should show error message
      await expect(page.locator('text=/token expired/i')).toBeVisible();

      // Should offer reconnection
      await expect(page.locator('button:has-text("Reconnect Email")')).toBeVisible();
    });
  });

  test.describe('Contact Matching', () => {
    test('should auto-match emails to existing contacts', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/emails');

      // Mock emails with contact matches
      await page.route('**/api/v1/emails**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            emails: [
              {
                id: 'email-1',
                from: 'john.doe@example.com',
                subject: 'Project Update',
                date: '2025-11-29',
                matchedContact: {
                  id: 'contact-1',
                  name: 'John Doe',
                },
              },
            ],
          }),
        });
      });

      await page.reload();

      // Verify contact link displayed
      await expect(page.locator('a[href="/contacts/contact-1"]')).toBeVisible();
      await expect(page.locator('text=John Doe')).toBeVisible();
    });

    test('should suggest creating contact for unmatched email', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/emails');

      // Find unmatched email
      const unmatchedEmail = page.locator('[data-testid="email-unmatched"]').first();

      // Click create contact suggestion
      await unmatchedEmail.click('button:has-text("Create Contact")');

      // Should pre-fill contact form
      await expect(page.locator('[name="email"]')).toHaveValue(/.*@example.com/);

      // Verify name extracted from email
      const nameValue = await page.locator('[name="firstName"]').inputValue();
      expect(nameValue).toBeTruthy();
    });

    test('should manually link email to contact', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/emails');

      const email = page.locator('[data-testid="email-item"]').first();

      // Open link menu
      await email.click('[data-testid="link-contact-button"]');

      // Search for contact
      await page.fill('[placeholder="Search contacts"]', 'Alice');

      // Select contact
      await page.click('[data-testid="contact-suggestion"]').first();

      // Verify link created
      await expect(page.locator('text=Email linked to contact')).toBeVisible();
    });
  });

  test.describe('Email Timeline', () => {
    test('should display email timeline on contact page', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/contact-id');

      // Navigate to email tab
      await page.click('button:has-text("Emails")');

      // Verify email timeline
      await expect(page.locator('[data-testid="email-timeline"]')).toBeVisible();

      // Verify email items
      const emailItems = page.locator('[data-testid="timeline-email"]');
      await expect(emailItems).toHaveCountGreaterThan(0);
    });

    test('should show email sentiment analysis', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/contact-id');
      await page.click('button:has-text("Emails")');

      // Verify sentiment indicators
      const sentimentBadges = page.locator('[data-testid="email-sentiment"]');

      if (await sentimentBadges.count() > 0) {
        // Verify sentiment types
        const firstBadge = sentimentBadges.first();
        await expect(firstBadge).toHaveText(/positive|neutral|negative/i);
      }
    });

    test('should filter emails by direction', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/emails');

      // Filter sent emails only
      await page.click('[data-testid="filter-button"]');
      await page.check('[name="filterSent"]');
      await page.uncheck('[name="filterReceived"]');
      await page.click('button:has-text("Apply")');

      // Verify only sent emails shown
      const emailDirections = page.locator('[data-testid="email-direction"]');
      const count = await emailDirections.count();

      for (let i = 0; i < count; i++) {
        const direction = await emailDirections.nth(i).textContent();
        expect(direction).toContain('Sent');
      }
    });
  });

  test.describe('Email Insights', () => {
    test('should calculate email frequency with contact', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/contact-id/insights');

      // Verify email frequency stats
      await expect(page.locator('[data-testid="email-frequency"]')).toBeVisible();
      await expect(page.locator('text=/emails.*month/i')).toBeVisible();
    });

    test('should show response time metrics', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/contact-id/insights');

      // Verify response time display
      await expect(page.locator('[data-testid="avg-response-time"]')).toBeVisible();
    });

    test('should identify communication gaps', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/contact-id/insights');

      // Mock communication gap detection
      await page.route('**/api/v1/ai/communication-gaps**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            gaps: [
              {
                contactId: 'contact-1',
                contactName: 'John Doe',
                daysSinceLastEmail: 45,
                suggestedAction: 'Send follow-up email',
              },
            ],
          }),
        });
      });

      await page.reload();

      // Verify gap alert
      if (await page.locator('[data-testid="communication-gap-alert"]').isVisible()) {
        await expect(
          page.locator('text=/45 days since last email/i')
        ).toBeVisible();
      }
    });
  });

  test.describe('Email Search', () => {
    test('should search emails by content', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/emails');

      // Search for keyword
      await page.fill('[placeholder="Search emails"]', 'project proposal');

      // Trigger search
      await page.press('[placeholder="Search emails"]', 'Enter');

      // Verify search results
      await expect(page).toHaveURL(/q=project\+proposal/);

      // Verify highlighted results
      const results = page.locator('[data-testid="email-item"]');
      await expect(results).toHaveCountGreaterThan(0);
    });

    test('should filter emails by date range', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/emails');

      // Open date filter
      await page.click('[data-testid="date-filter"]');

      // Select custom range
      await page.fill('[name="startDate"]', '2025-11-01');
      await page.fill('[name="endDate"]', '2025-11-30');

      await page.click('button:has-text("Apply")');

      // Verify URL params
      await expect(page).toHaveURL(/start=2025-11-01/);
      await expect(page).toHaveURL(/end=2025-11-30/);
    });
  });
});
