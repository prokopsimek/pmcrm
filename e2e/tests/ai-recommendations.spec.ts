/**
 * E2E tests for US-050: AI Recommendations
 * Tests AI-powered contact suggestions and insights
 */
import { test, expect } from '../fixtures/auth.fixture';

test.describe('AI Recommendations (US-050)', () => {
  test.describe('Recommendation Dashboard', () => {
    test('should display AI recommendations on dashboard', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/dashboard');

      // Mock AI recommendations
      await page.route('**/api/v1/ai/recommendations**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            recommendations: [
              {
                id: 'rec-1',
                type: 'reconnect',
                contactId: 'contact-1',
                contactName: 'Alice Johnson',
                reason: 'No contact in 45 days. Usually contact every 30 days.',
                priority: 'high',
                confidence: 0.87,
              },
              {
                id: 'rec-2',
                type: 'follow_up',
                contactId: 'contact-2',
                contactName: 'Bob Smith',
                reason: 'Last email went unanswered',
                priority: 'medium',
                confidence: 0.72,
              },
            ],
          }),
        });
      });

      await page.reload();

      // Verify recommendations section
      await expect(page.locator('[data-testid="ai-recommendations"]')).toBeVisible();

      // Verify recommendation cards
      await expect(page.locator('[data-testid="recommendation-card"]')).toHaveCount(2);
    });

    test('should categorize recommendations by type', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations');

      // Verify recommendation types
      await expect(page.locator('text=Reconnect Suggestions')).toBeVisible();
      await expect(page.locator('text=Follow-up Reminders')).toBeVisible();
      await expect(page.locator('text=Relationship Strengthening')).toBeVisible();
    });

    test('should show confidence scores', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations');

      // Verify confidence display
      const confidenceScores = page.locator('[data-testid="confidence-score"]');
      await expect(confidenceScores.first()).toBeVisible();

      // Verify score format
      const scoreText = await confidenceScores.first().textContent();
      expect(scoreText).toMatch(/\d+%/);
    });

    test('should prioritize recommendations', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations');

      // Sort by priority
      await page.click('[data-testid="sort-by-priority"]');

      // Verify high priority items first
      const priorityBadges = page.locator('[data-testid="priority-badge"]');
      const firstPriority = await priorityBadges.first().textContent();
      expect(firstPriority).toContain('High');
    });
  });

  test.describe('Recommendation Actions', () => {
    test('should accept reconnect suggestion', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations');

      const recommendationCard = page.locator('[data-testid="recommendation-card"]').first();

      // Click accept button
      await recommendationCard.click('button:has-text("Accept")');

      // Should create reminder or open contact
      await expect(page).toHaveURL(/\/contacts\/|\/reminders/);
    });

    test('should dismiss recommendation', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations');

      const initialCount = await page.locator('[data-testid="recommendation-card"]').count();

      // Dismiss first recommendation
      await page.click('[data-testid="dismiss-button"]').first();

      // Confirm dismissal
      await page.click('button:has-text("Dismiss")');

      // Verify count decreased
      const newCount = await page.locator('[data-testid="recommendation-card"]').count();
      expect(newCount).toBe(initialCount - 1);
    });

    test('should provide feedback on recommendation', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations');

      const recommendationCard = page.locator('[data-testid="recommendation-card"]').first();

      // Click feedback button
      await recommendationCard.click('[data-testid="feedback-button"]');

      // Select helpful
      await page.click('button:has-text("Helpful")');

      // Verify feedback submitted
      await expect(page.locator('text=Thank you for your feedback')).toBeVisible();
    });

    test('should snooze recommendation', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations');

      const recommendationCard = page.locator('[data-testid="recommendation-card"]').first();

      // Open snooze menu
      await recommendationCard.click('[data-testid="snooze-button"]');

      // Select snooze duration
      await page.click('button:has-text("1 week")');

      // Verify snoozed
      await expect(page.locator('text=Recommendation snoozed')).toBeVisible();
    });
  });

  test.describe('Reconnect Suggestions', () => {
    test('should suggest contacts to reconnect with', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations?type=reconnect');

      // Mock reconnect suggestions
      await page.route('**/api/v1/ai/recommendations/reconnect**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            suggestions: [
              {
                contactId: 'contact-1',
                contactName: 'Jane Doe',
                daysSinceLastContact: 60,
                averageContactFrequency: 30,
                relationshipStrength: 8,
                suggestedMessage: 'Hey Jane, hope you\'re doing well! Want to catch up over coffee?',
              },
            ],
          }),
        });
      });

      await page.reload();

      // Verify suggestion details
      await expect(page.locator('text=Jane Doe')).toBeVisible();
      await expect(page.locator('text=/60 days/i')).toBeVisible();
    });

    test('should generate suggested message', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations?type=reconnect');

      const card = page.locator('[data-testid="recommendation-card"]').first();

      // Click to expand suggested message
      await card.click('[data-testid="show-message"]');

      // Verify message displayed
      await expect(card.locator('[data-testid="suggested-message"]')).toBeVisible();

      // Verify message content
      const messageText = await card.locator('[data-testid="suggested-message"]').textContent();
      expect(messageText).toBeTruthy();
    });

    test('should copy suggested message', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations?type=reconnect');

      const card = page.locator('[data-testid="recommendation-card"]').first();

      // Click copy button
      await card.click('button:has-text("Copy Message")');

      // Verify copied notification
      await expect(page.locator('text=Message copied')).toBeVisible();
    });

    test('should compose email with suggestion', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations?type=reconnect');

      const card = page.locator('[data-testid="recommendation-card"]').first();

      // Click compose email
      await card.click('button:has-text("Send Email")');

      // Should open email modal or redirect
      await expect(
        page.locator('[data-testid="email-compose-modal"]')
      ).toBeVisible();

      // Verify recipient and message pre-filled
      const recipientValue = await page.locator('[name="to"]').inputValue();
      expect(recipientValue).toBeTruthy();
    });
  });

  test.describe('Relationship Insights', () => {
    test('should display relationship health score', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/contact-id/insights');

      // Mock AI insights
      await page.route('**/api/v1/ai/insights/contact-id**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            healthScore: 75,
            trend: 'improving',
            factors: [
              { factor: 'Email frequency', impact: 'positive', score: 8 },
              { factor: 'Response time', impact: 'neutral', score: 5 },
              { factor: 'Meeting cadence', impact: 'negative', score: 3 },
            ],
          }),
        });
      });

      await page.reload();

      // Verify health score displayed
      await expect(page.locator('[data-testid="health-score"]')).toContainText('75');

      // Verify trend indicator
      await expect(page.locator('[data-testid="trend-improving"]')).toBeVisible();
    });

    test('should show communication pattern analysis', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/contact-id/insights');

      // Verify pattern sections
      await expect(page.locator('text=Communication Patterns')).toBeVisible();

      // Verify pattern details
      await expect(page.locator('[data-testid="email-frequency-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="response-time-metric"]')).toBeVisible();
    });

    test('should identify communication gaps', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/contact-id/insights');

      // Verify gap detection
      if (await page.locator('[data-testid="communication-gap"]').isVisible()) {
        await expect(
          page.locator('text=/gap detected/i')
        ).toBeVisible();

        // Verify suggested action
        await expect(
          page.locator('[data-testid="suggested-action"]')
        ).toBeVisible();
      }
    });
  });

  test.describe('Smart Suggestions', () => {
    test('should suggest best time to contact', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/contact-id');

      // Click smart suggest button
      await page.click('button:has-text("Smart Suggest")');

      // Mock time suggestion
      await page.route('**/api/v1/ai/suggest-contact-time**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bestTime: '14:00',
            bestDay: 'Tuesday',
            confidence: 0.82,
            reason: 'Based on response patterns, Tuesday afternoons work best',
          }),
        });
      });

      await page.reload();
      await page.click('button:has-text("Smart Suggest")');

      // Verify suggestion displayed
      await expect(page.locator('text=/Tuesday.*14:00/i')).toBeVisible();
      await expect(page.locator('text=82% confidence')).toBeVisible();
    });

    test('should suggest conversation topics', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/contact-id');

      await page.click('button:has-text("Topic Ideas")');

      // Mock topic suggestions
      await page.route('**/api/v1/ai/suggest-topics**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            topics: [
              {
                topic: 'Latest project update',
                reason: 'Last discussed in email thread',
                relevance: 0.9,
              },
              {
                topic: 'Industry conference next month',
                reason: 'Shared interest in tech events',
                relevance: 0.75,
              },
            ],
          }),
        });
      });

      await page.reload();
      await page.click('button:has-text("Topic Ideas")');

      // Verify topics displayed
      await expect(page.locator('text=Latest project update')).toBeVisible();
      await expect(page.locator('text=Industry conference')).toBeVisible();
    });

    test('should suggest similar contacts', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts/contact-id');

      // Navigate to similar contacts section
      await page.click('tab:has-text("Similar Contacts")');

      // Verify similar contacts displayed
      await expect(page.locator('[data-testid="similar-contact-card"]')).toHaveCountGreaterThan(0);

      // Verify similarity score
      await expect(page.locator('[data-testid="similarity-score"]')).toBeVisible();
    });
  });

  test.describe('Recommendation Settings', () => {
    test('should configure recommendation preferences', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/settings/recommendations');

      // Enable/disable recommendation types
      await page.check('[name="enableReconnectSuggestions"]');
      await page.check('[name="enableFollowUpReminders"]');
      await page.uncheck('[name="enableTopicSuggestions"]');

      // Set frequency
      await page.selectOption('[name="recommendationFrequency"]', 'daily');

      // Save settings
      await page.click('button:has-text("Save Settings")');

      await expect(page.locator('text=Settings saved')).toBeVisible();
    });

    test('should set quiet hours for recommendations', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/settings/recommendations');

      // Enable quiet hours
      await page.check('[name="enableQuietHours"]');

      // Set time range
      await page.fill('[name="quietHoursStart"]', '22:00');
      await page.fill('[name="quietHoursEnd"]', '08:00');

      await page.click('button:has-text("Save Settings")');

      await expect(page.locator('text=Quiet hours set')).toBeVisible();
    });

    test('should customize recommendation threshold', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/settings/recommendations');

      // Set minimum confidence threshold
      await page.fill('[name="minConfidence"]', '70');

      // Set minimum priority
      await page.selectOption('[name="minPriority"]', 'medium');

      await page.click('button:has-text("Save Settings")');

      await expect(page.locator('text=Thresholds updated')).toBeVisible();
    });
  });

  test.describe('AI Model Performance', () => {
    test('should display model accuracy metrics', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/settings/recommendations/analytics');

      // Verify accuracy metrics
      await expect(page.locator('[data-testid="model-accuracy"]')).toBeVisible();
      await expect(page.locator('[data-testid="acceptance-rate"]')).toBeVisible();
      await expect(page.locator('[data-testid="dismissal-rate"]')).toBeVisible();
    });

    test('should show recommendation history', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations/history');

      // Verify history table
      await expect(page.locator('[data-testid="recommendation-history-table"]')).toBeVisible();

      // Verify columns
      await expect(page.locator('th:has-text("Date")')).toBeVisible();
      await expect(page.locator('th:has-text("Type")')).toBeVisible();
      await expect(page.locator('th:has-text("Contact")')).toBeVisible();
      await expect(page.locator('th:has-text("Action Taken")')).toBeVisible();
    });

    test('should filter history by outcome', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/recommendations/history');

      // Filter by accepted recommendations
      await page.click('[data-testid="filter-accepted"]');

      // Verify filtered results
      const actionCells = page.locator('[data-testid="action-cell"]');
      const count = await actionCells.count();

      for (let i = 0; i < count; i++) {
        const actionText = await actionCells.nth(i).textContent();
        expect(actionText).toContain('Accepted');
      }
    });
  });
});
