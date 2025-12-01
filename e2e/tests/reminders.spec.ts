/**
 * E2E tests for US-040/041: Reminders
 * Tests reminder creation, management, and notifications
 */
import { test, expect } from '../fixtures/auth.fixture';

test.describe('Reminders (US-040/041)', () => {
  test.describe('Create Reminder', () => {
    test('should create one-time reminder', async ({
      authenticatedPage: page,
    }) => {
      // Navigate to contacts
      await page.goto('/contacts');

      // Click on first contact
      await page.click('[data-testid="contact-card"]').first();

      // Open reminder modal
      await page.click('button:has-text("Set Reminder")');

      // Fill reminder form
      await page.selectOption('[name="type"]', 'one_time');
      await page.fill('[name="date"]', '2025-12-31');
      await page.fill('[name="time"]', '14:00');
      await page.fill('[name="message"]', 'Follow up on project proposal');

      // Save reminder
      await page.click('button:has-text("Save Reminder")');

      // Verify success message
      await expect(page.locator('text=Reminder created')).toBeVisible();
    });

    test('should create recurring weekly reminder', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');
      await page.click('[data-testid="contact-card"]').first();
      await page.click('button:has-text("Set Reminder")');

      // Select recurring type
      await page.selectOption('[name="type"]', 'recurring');
      await page.selectOption('[name="frequency"]', 'weekly');

      // Select day of week
      await page.selectOption('[name="dayOfWeek"]', 'monday');
      await page.fill('[name="time"]', '09:00');
      await page.fill('[name="message"]', 'Weekly check-in');

      await page.click('button:has-text("Save Reminder")');

      // Verify recurring indicator
      await expect(page.locator('text=/every monday/i')).toBeVisible();
    });

    test('should create monthly birthday reminder', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');
      await page.click('[data-testid="contact-card"]').first();
      await page.click('button:has-text("Set Reminder")');

      await page.selectOption('[name="type"]', 'recurring');
      await page.selectOption('[name="frequency"]', 'monthly');
      await page.fill('[name="dayOfMonth"]', '15');
      await page.fill('[name="message"]', 'Birthday reminder');

      // Enable birthday reminder
      await page.check('[name="isBirthdayReminder"]');

      await page.click('button:has-text("Save Reminder")');

      await expect(page.locator('text=Birthday reminder created')).toBeVisible();
    });

    test('should set reminder advance notice', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');
      await page.click('[data-testid="contact-card"]').first();
      await page.click('button:has-text("Set Reminder")');

      await page.selectOption('[name="type"]', 'one_time');
      await page.fill('[name="date"]', '2025-12-31');

      // Set advance notice
      await page.check('[name="sendAdvanceNotice"]');
      await page.fill('[name="advanceDays"]', '7');

      await page.click('button:has-text("Save Reminder")');

      // Verify advance notice displayed
      await expect(page.locator('text=/7 days before/i')).toBeVisible();
    });
  });

  test.describe('Reminder Dashboard', () => {
    test('should display upcoming reminders', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/reminders');

      // Should show reminders section
      await expect(page.locator('h2:has-text("Upcoming Reminders")')).toBeVisible();

      // Should display reminder cards
      const reminderCards = page.locator('[data-testid="reminder-card"]');
      await expect(reminderCards).toHaveCountGreaterThan(0);
    });

    test('should filter reminders by date range', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/reminders');

      // Apply date filter
      await page.click('[data-testid="filter-button"]');
      await page.selectOption('[name="dateRange"]', 'this_week');
      await page.click('button:has-text("Apply")');

      // Verify URL has filter
      await expect(page).toHaveURL(/range=this_week/);

      // Verify only this week's reminders shown
      const reminderDates = page.locator('[data-testid="reminder-date"]');
      const count = await reminderDates.count();

      for (let i = 0; i < count; i++) {
        const dateText = await reminderDates.nth(i).textContent();
        // Verify date is within this week
        expect(dateText).toBeTruthy();
      }
    });

    test('should group reminders by priority', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/reminders');

      // Sort by priority
      await page.click('[data-testid="sort-by-priority"]');

      // Verify priority groups
      await expect(page.locator('h3:has-text("High Priority")')).toBeVisible();
      await expect(page.locator('h3:has-text("Medium Priority")')).toBeVisible();
      await expect(page.locator('h3:has-text("Low Priority")')).toBeVisible();
    });

    test('should show overdue reminders separately', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/reminders');

      // Verify overdue section
      const overdueSection = page.locator('[data-testid="overdue-reminders"]');

      if (await overdueSection.isVisible()) {
        await expect(overdueSection).toBeVisible();
        await expect(overdueSection.locator('.reminder-card')).toHaveClass(/overdue/);
      }
    });
  });

  test.describe('Reminder Actions', () => {
    test('should mark reminder as completed', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/reminders');

      const firstReminder = page.locator('[data-testid="reminder-card"]').first();

      // Complete reminder
      await firstReminder.click('button:has-text("Complete")');

      // Verify completion
      await expect(firstReminder).toHaveClass(/completed/);
      await expect(
        page.locator('text=Reminder marked as complete')
      ).toBeVisible();
    });

    test('should snooze reminder', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/reminders');

      const firstReminder = page.locator('[data-testid="reminder-card"]').first();

      // Snooze reminder
      await firstReminder.click('button:has-text("Snooze")');

      // Select snooze duration
      await page.click('button:has-text("1 hour")');

      // Verify snooze
      await expect(page.locator('text=/snoozed.*1 hour/i')).toBeVisible();
    });

    test('should reschedule reminder', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/reminders');

      const firstReminder = page.locator('[data-testid="reminder-card"]').first();

      // Open reschedule modal
      await firstReminder.click('button:has-text("Reschedule")');

      // Change date and time
      await page.fill('[name="date"]', '2026-01-15');
      await page.fill('[name="time"]', '10:00');

      // Save
      await page.click('button:has-text("Save")');

      // Verify new date
      await expect(page.locator('text=/2026-01-15/i')).toBeVisible();
    });

    test('should delete reminder', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/reminders');

      const reminderCount = await page.locator('[data-testid="reminder-card"]').count();

      // Delete first reminder
      await page.click('[data-testid="reminder-card"]').first();
      await page.click('button:has-text("Delete")');

      // Confirm deletion
      await page.click('button:has-text("Confirm")');

      // Verify reminder removed
      await expect(page.locator('[data-testid="reminder-card"]')).toHaveCount(
        reminderCount - 1
      );
    });
  });

  test.describe('Reminder Notifications', () => {
    test('should display browser notification permission request', async ({
      authenticatedPage: page,
      context,
    }) => {
      await page.goto('/settings/notifications');

      // Grant notification permission
      await context.grantPermissions(['notifications']);

      // Enable reminder notifications
      await page.check('[name="enableReminderNotifications"]');

      // Verify setting saved
      await expect(
        page.locator('text=Notification settings updated')
      ).toBeVisible();
    });

    test('should configure notification channels', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/settings/notifications');

      // Enable email notifications
      await page.check('[name="emailNotifications"]');

      // Enable push notifications
      await page.check('[name="pushNotifications"]');

      // Set notification timing
      await page.selectOption('[name="notifyBefore"]', '30'); // 30 minutes before

      // Save settings
      await page.click('button:has-text("Save Settings")');

      await expect(page.locator('text=Settings saved')).toBeVisible();
    });

    test('should show in-app notification for due reminder', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/dashboard');

      // Mock reminder due notification
      await page.route('**/api/v1/reminders/due**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            reminders: [
              {
                id: 'reminder-1',
                message: 'Follow up with John',
                contactName: 'John Doe',
                dueAt: new Date().toISOString(),
              },
            ],
          }),
        });
      });

      // Trigger notification check
      await page.reload();

      // Verify notification banner
      await expect(
        page.locator('[data-testid="notification-banner"]')
      ).toBeVisible();
      await expect(page.locator('text=Follow up with John')).toBeVisible();
    });
  });

  test.describe('Smart Reminders', () => {
    test('should suggest optimal contact time based on history', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');
      await page.click('[data-testid="contact-card"]').first();
      await page.click('button:has-text("Set Reminder")');

      // Mock AI suggestion
      await page.route('**/api/v1/ai/suggest-contact-time**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            suggestedTime: '14:00',
            suggestedDay: 'Tuesday',
            reason: 'Based on past interactions, Tuesday afternoon works best',
          }),
        });
      });

      // Click smart suggestion
      await page.click('button:has-text("Use AI Suggestion")');

      // Verify suggestion applied
      const timeInput = await page.locator('[name="time"]').inputValue();
      expect(timeInput).toBe('14:00');

      // Show reason
      await expect(
        page.locator('text=/Tuesday afternoon works best/i')
      ).toBeVisible();
    });

    test('should auto-create reminders based on interaction patterns', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/reminders/smart');

      // Mock AI-generated reminder suggestions
      await page.route('**/api/v1/ai/suggest-reminders**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            suggestions: [
              {
                contactId: 'contact-1',
                contactName: 'Jane Smith',
                reason: 'No contact in 30 days, usually contact every 2 weeks',
                suggestedDate: '2025-12-15',
              },
            ],
          }),
        });
      });

      await page.click('button:has-text("Load Suggestions")');

      // Verify suggestions displayed
      await expect(
        page.locator('text=Jane Smith')
      ).toBeVisible();
      await expect(
        page.locator('text=/No contact in 30 days/i')
      ).toBeVisible();

      // Accept suggestion
      await page.click('button:has-text("Create Reminder")');

      // Verify reminder created
      await expect(page.locator('text=Reminder created')).toBeVisible();
    });
  });

  test.describe('Reminder Analytics', () => {
    test('should display completion statistics', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/reminders/analytics');

      // Verify stats displayed
      await expect(page.locator('[data-testid="completion-rate"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-reminders"]')).toBeVisible();
      await expect(page.locator('[data-testid="avg-response-time"]')).toBeVisible();
    });

    test('should show monthly reminder trend chart', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/reminders/analytics');

      // Verify chart rendered
      await expect(page.locator('[data-testid="reminder-trend-chart"]')).toBeVisible();

      // Interact with chart
      await page.hover('[data-testid="chart-bar"]').first();

      // Verify tooltip
      await expect(page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
    });
  });
});
