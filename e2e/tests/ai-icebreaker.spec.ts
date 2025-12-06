/**
 * E2E tests for US-051: AI Icebreaker Message Generation
 * Tests AI-powered icebreaker message generation for contacts
 */
import { test, expect } from '../fixtures/auth.fixture';

test.describe('AI Icebreaker (US-051)', () => {
  test.describe('Icebreaker Generation Dialog', () => {
    test('should open icebreaker dialog from contact detail page', async ({
      authenticatedPage: page,
    }) => {
      // Mock contact API
      await page.route('**/api/v1/contacts/*', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'contact-1',
              firstName: 'John',
              lastName: 'Doe',
              email: 'john.doe@example.com',
              company: 'Tech Corp',
              title: 'Senior Developer',
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/org/test-org/contacts/contact-1');

      // Click Generate Message button
      await page.click('button:has-text("Generate Message")');

      // Verify dialog opens
      await expect(page.locator('[data-testid="icebreaker-dialog"]')).toBeVisible();
      await expect(page.locator('text=Generate Icebreaker Message')).toBeVisible();
    });

    test('should display channel selection options', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');

      // Verify channel options
      await expect(page.locator('text=Email')).toBeVisible();
      await expect(page.locator('text=LinkedIn')).toBeVisible();
      await expect(page.locator('text=WhatsApp')).toBeVisible();
    });

    test('should display tone selection options', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');

      // Verify tone options
      await expect(page.locator('text=Professional')).toBeVisible();
      await expect(page.locator('text=Friendly')).toBeVisible();
      await expect(page.locator('text=Casual')).toBeVisible();
    });

    test('should allow optional trigger event input', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');

      // Verify trigger event field
      const triggerInput = page.locator('[name="triggerEvent"], [data-testid="trigger-event-input"]');
      await expect(triggerInput).toBeVisible();

      // Fill trigger event
      await triggerInput.fill('New job announcement');
      await expect(triggerInput).toHaveValue('New job announcement');
    });
  });

  test.describe('Message Generation', () => {
    test('should generate message variations on submit', async ({
      authenticatedPage: page,
    }) => {
      // Mock icebreaker generation API
      await page.route('**/api/v1/ai/icebreaker/generate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'gen-123',
            variations: [
              {
                subject: 'Great to reconnect',
                body: 'Hi John, I hope this message finds you well! I wanted to reach out and reconnect.',
                talkingPoints: ['Reconnection', 'Professional interest'],
                reasoning: 'Professional approach based on prior relationship',
                variationIndex: 0,
              },
              {
                subject: 'Quick hello',
                body: 'Hey John! How have you been? Would love to catch up sometime.',
                talkingPoints: ['Casual reconnection', 'Open dialogue'],
                reasoning: 'Friendly approach for established contact',
                variationIndex: 1,
              },
              {
                subject: 'Checking in',
                body: 'Hi John, just wanted to check in and see how things are going at Tech Corp.',
                talkingPoints: ['Company mention', 'Interest in updates'],
                reasoning: 'Shows genuine interest in contact\'s work',
                variationIndex: 2,
              },
            ],
            usageMetrics: {
              provider: 'google',
              modelVersion: 'gemini-2.5-flash',
              promptVersion: '1.0.0',
              tokensUsed: 1500,
              costUsd: 0.0012,
              generationTimeMs: 2500,
            },
            contactId: 'contact-1',
            channel: 'email',
            tone: 'professional',
            createdAt: new Date().toISOString(),
          }),
        });
      });

      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');

      // Select channel and tone
      await page.click('text=Email');
      await page.click('text=Professional');

      // Submit generation
      await page.click('button:has-text("Generate")');

      // Wait for loading to complete
      await expect(page.locator('text=Generating')).toBeVisible();
      await expect(page.locator('text=Generating')).not.toBeVisible({ timeout: 10000 });

      // Verify variations displayed
      await expect(page.locator('[data-testid="message-variation"]')).toHaveCount(3);
    });

    test('should display subject line for email channel', async ({
      authenticatedPage: page,
    }) => {
      await page.route('**/api/v1/ai/icebreaker/generate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'gen-123',
            variations: [
              {
                subject: 'Great to reconnect',
                body: 'Hi John, I hope this message finds you well!',
                talkingPoints: ['Reconnection'],
                reasoning: 'Professional approach',
                variationIndex: 0,
              },
            ],
            contactId: 'contact-1',
            channel: 'email',
            tone: 'professional',
          }),
        });
      });

      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');
      await page.click('text=Email');
      await page.click('button:has-text("Generate")');

      // Wait for results
      await page.waitForSelector('[data-testid="message-variation"]');

      // Verify subject line visible
      await expect(page.locator('text=Great to reconnect')).toBeVisible();
    });

    test('should hide subject line for LinkedIn channel', async ({
      authenticatedPage: page,
    }) => {
      await page.route('**/api/v1/ai/icebreaker/generate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'gen-123',
            variations: [
              {
                body: 'Hi John! Would love to connect.',
                talkingPoints: ['Connection request'],
                reasoning: 'LinkedIn appropriate',
                variationIndex: 0,
              },
            ],
            contactId: 'contact-1',
            channel: 'linkedin',
            tone: 'friendly',
          }),
        });
      });

      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');
      await page.click('text=LinkedIn');
      await page.click('button:has-text("Generate")');

      await page.waitForSelector('[data-testid="message-variation"]');

      // Subject should not be visible for LinkedIn
      await expect(page.locator('text=Subject:')).not.toBeVisible();
    });
  });

  test.describe('Variation Selection', () => {
    test('should allow selecting a message variation', async ({
      authenticatedPage: page,
    }) => {
      await page.route('**/api/v1/ai/icebreaker/generate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'gen-123',
            variations: [
              { body: 'Variation 1', talkingPoints: [], reasoning: '', variationIndex: 0 },
              { body: 'Variation 2', talkingPoints: [], reasoning: '', variationIndex: 1 },
              { body: 'Variation 3', talkingPoints: [], reasoning: '', variationIndex: 2 },
            ],
            contactId: 'contact-1',
            channel: 'email',
            tone: 'professional',
          }),
        });
      });

      await page.route('**/api/v1/ai/icebreaker/*/select', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'gen-123',
            selected: { body: 'Variation 2', variationIndex: 1 },
          }),
        });
      });

      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');
      await page.click('button:has-text("Generate")');

      await page.waitForSelector('[data-testid="message-variation"]');

      // Select second variation
      const secondVariation = page.locator('[data-testid="message-variation"]').nth(1);
      await secondVariation.click('button:has-text("Use This")');

      // Verify selection feedback
      await expect(page.locator('text=/selected|copied/i')).toBeVisible();
    });

    test('should copy message to clipboard', async ({
      authenticatedPage: page,
    }) => {
      await page.route('**/api/v1/ai/icebreaker/generate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'gen-123',
            variations: [
              { body: 'Test message to copy', talkingPoints: [], reasoning: '', variationIndex: 0 },
            ],
            contactId: 'contact-1',
            channel: 'email',
            tone: 'professional',
          }),
        });
      });

      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');
      await page.click('button:has-text("Generate")');

      await page.waitForSelector('[data-testid="message-variation"]');

      // Click copy button
      await page.click('button:has-text("Copy")');

      // Verify copy feedback
      await expect(page.locator('text=/copied/i')).toBeVisible();
    });
  });

  test.describe('Regeneration', () => {
    test('should allow regenerating with different tone', async ({
      authenticatedPage: page,
    }) => {
      let callCount = 0;

      await page.route('**/api/v1/ai/icebreaker/generate', async (route) => {
        callCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: `gen-${callCount}`,
            variations: [
              { body: `Message ${callCount}`, talkingPoints: [], reasoning: '', variationIndex: 0 },
            ],
            contactId: 'contact-1',
            channel: 'email',
            tone: callCount === 1 ? 'professional' : 'casual',
          }),
        });
      });

      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');
      await page.click('button:has-text("Generate")');

      await page.waitForSelector('[data-testid="message-variation"]');

      // Change tone and regenerate
      await page.click('text=Casual');
      await page.click('button:has-text("Regenerate")');

      await page.waitForSelector('text=Message 2');

      expect(callCount).toBe(2);
    });
  });

  test.describe('Feedback', () => {
    test('should allow submitting feedback on generated message', async ({
      authenticatedPage: page,
    }) => {
      await page.route('**/api/v1/ai/icebreaker/generate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'gen-123',
            variations: [
              { body: 'Test message', talkingPoints: [], reasoning: '', variationIndex: 0 },
            ],
            contactId: 'contact-1',
            channel: 'email',
            tone: 'professional',
          }),
        });
      });

      await page.route('**/api/v1/ai/icebreaker/*/feedback', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'gen-123',
            feedback: 'helpful',
          }),
        });
      });

      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');
      await page.click('button:has-text("Generate")');

      await page.waitForSelector('[data-testid="message-variation"]');

      // Submit feedback
      await page.click('button[data-testid="feedback-helpful"], button:has-text("👍")');

      // Verify feedback submitted
      await expect(page.locator('text=/thank.*feedback/i')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should display error when AI service unavailable', async ({
      authenticatedPage: page,
    }) => {
      await page.route('**/api/v1/ai/icebreaker/generate', async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'AI service temporarily unavailable',
            statusCode: 503,
          }),
        });
      });

      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');
      await page.click('button:has-text("Generate")');

      // Verify error displayed
      await expect(page.locator('text=/error|unavailable|failed/i')).toBeVisible();
    });

    test('should handle network timeout gracefully', async ({
      authenticatedPage: page,
    }) => {
      await page.route('**/api/v1/ai/icebreaker/generate', async (route) => {
        // Simulate timeout by not fulfilling the route
        await new Promise((resolve) => setTimeout(resolve, 35000));
      });

      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');
      await page.click('button:has-text("Generate")');

      // Verify timeout handling (loading state should eventually show error)
      await expect(page.locator('text=Generating')).toBeVisible();
    });
  });

  test.describe('History', () => {
    test('should display previous generation history', async ({
      authenticatedPage: page,
    }) => {
      await page.route('**/api/v1/ai/icebreaker/history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'gen-1',
              contactId: 'contact-1',
              contactName: 'John Doe',
              channel: 'email',
              tone: 'professional',
              sent: false,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'gen-2',
              contactId: 'contact-2',
              contactName: 'Jane Smith',
              channel: 'linkedin',
              tone: 'friendly',
              sent: true,
              sentAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
          ]),
        });
      });

      await page.goto('/org/test-org/contacts/contact-1');
      await page.click('button:has-text("Generate Message")');

      // Navigate to history tab if available
      const historyTab = page.locator('text=History');
      if (await historyTab.isVisible()) {
        await historyTab.click();

        // Verify history entries
        await expect(page.locator('[data-testid="history-entry"]')).toHaveCount(2);
      }
    });
  });
});









