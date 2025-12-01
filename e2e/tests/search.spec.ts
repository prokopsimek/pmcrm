/**
 * E2E tests for US-060: Search
 * Tests full-text search, semantic search, and filters
 */
import { test, expect } from '../fixtures/auth.fixture';

test.describe('Search (US-060)', () => {
  test.describe('Full-Text Search', () => {
    test('should search contacts by name', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Type in search box
      await page.fill('[placeholder*="Search"]', 'John Doe');

      // Wait for search results
      await page.waitForURL(/q=John\+Doe/);

      // Verify results contain search term
      await expect(page.locator('text=John Doe')).toBeVisible();
    });

    test('should search by email', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      await page.fill('[placeholder*="Search"]', 'john@example.com');

      // Verify email match
      await expect(page.locator('text=john@example.com')).toBeVisible();
    });

    test('should search by company', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      await page.fill('[placeholder*="Search"]', 'Acme Corp');

      // Verify company match
      await expect(page.locator('text=Acme Corp')).toBeVisible();
    });

    test('should search by phone number', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      await page.fill('[placeholder*="Search"]', '+1234567890');

      // Verify phone match
      await expect(page.locator('text=+1234567890')).toBeVisible();
    });

    test('should handle special characters in search', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      await page.fill('[placeholder*="Search"]', "O'Brien");

      // Should not cause errors
      await expect(page.locator('[data-testid="search-error"]')).not.toBeVisible();
    });
  });

  test.describe('Global Search (Cmd+K)', () => {
    test('should open global search with keyboard shortcut', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/dashboard');

      // Press Cmd+K (or Ctrl+K on Windows/Linux)
      await page.keyboard.press('Meta+K');

      // Verify search modal opened
      await expect(page.locator('[data-testid="global-search-modal"]')).toBeVisible();
    });

    test('should search across all entities', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/dashboard');
      await page.keyboard.press('Meta+K');

      // Type search query
      await page.fill('[role="searchbox"]', 'project');

      // Mock search results
      await page.route('**/api/v1/search**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            contacts: [
              { id: '1', name: 'Project Manager', type: 'contact' },
            ],
            emails: [
              { id: '2', subject: 'Project Update', type: 'email' },
            ],
            interactions: [
              { id: '3', summary: 'Project discussion', type: 'interaction' },
            ],
          }),
        });
      });

      // Verify results grouped by type
      await expect(page.locator('text=Contacts')).toBeVisible();
      await expect(page.locator('text=Emails')).toBeVisible();
      await expect(page.locator('text=Interactions')).toBeVisible();
    });

    test('should navigate to result on Enter', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/dashboard');
      await page.keyboard.press('Meta+K');

      await page.fill('[role="searchbox"]', 'John Doe');

      // Wait for results
      await page.waitForSelector('[role="option"]');

      // Press Enter to navigate to first result
      await page.keyboard.press('Enter');

      // Should navigate to contact page
      await expect(page).toHaveURL(/\/contacts\/[\w-]+/);
    });

    test('should navigate results with arrow keys', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/dashboard');
      await page.keyboard.press('Meta+K');

      await page.fill('[role="searchbox"]', 'test');

      // Wait for results
      await page.waitForSelector('[role="option"]');

      // Press down arrow
      await page.keyboard.press('ArrowDown');

      // Verify second result highlighted
      const selectedOption = page.locator('[role="option"][aria-selected="true"]');
      await expect(selectedOption).toHaveCount(1);
    });

    test('should close modal with Escape', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/dashboard');
      await page.keyboard.press('Meta+K');

      await expect(page.locator('[data-testid="global-search-modal"]')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Modal should close
      await expect(page.locator('[data-testid="global-search-modal"]')).not.toBeVisible();
    });
  });

  test.describe('Semantic Search', () => {
    test('should enable semantic search mode', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Toggle semantic search
      await page.click('[data-testid="semantic-search-toggle"]');

      // Verify mode indicator
      await expect(page.locator('text=Semantic Search Active')).toBeVisible();
    });

    test('should search with natural language query', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Enable semantic search
      await page.click('[data-testid="semantic-search-toggle"]');

      // Mock semantic search API
      await page.route('**/api/v1/search/semantic**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                id: 'contact-1',
                name: 'Alice Johnson',
                title: 'Software Engineer',
                company: 'TechCorp',
                relevanceScore: 0.95,
              },
              {
                id: 'contact-2',
                name: 'Bob Smith',
                title: 'Senior Developer',
                company: 'DevShop',
                relevanceScore: 0.87,
              },
            ],
          }),
        });
      });

      // Search with natural language
      await page.fill('[placeholder*="Search"]', 'software engineers in San Francisco');

      // Verify results with relevance scores
      await expect(page.locator('[data-testid="relevance-score"]')).toBeVisible();
      await expect(page.locator('text=Alice Johnson')).toBeVisible();
    });

    test('should explain semantic match reasoning', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');
      await page.click('[data-testid="semantic-search-toggle"]');

      await page.fill('[placeholder*="Search"]', 'AI experts');

      // Click on result to see explanation
      await page.click('[data-testid="search-result"]').first();

      // Verify explanation modal
      if (await page.locator('[data-testid="match-explanation"]').isVisible()) {
        await expect(
          page.locator('text=/matched because/i')
        ).toBeVisible();
      }
    });
  });

  test.describe('Advanced Filters', () => {
    test('should filter by relationship strength', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Open filters
      await page.click('[data-testid="advanced-filters"]');

      // Set relationship strength range
      await page.fill('[name="minRelationshipStrength"]', '7');
      await page.fill('[name="maxRelationshipStrength"]', '10');

      await page.click('button:has-text("Apply Filters")');

      // Verify URL params
      await expect(page).toHaveURL(/minStrength=7/);
      await expect(page).toHaveURL(/maxStrength=10/);
    });

    test('should filter by last contact date', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      await page.click('[data-testid="advanced-filters"]');

      // Select last contact date range
      await page.selectOption('[name="lastContactPeriod"]', 'last_30_days');

      await page.click('button:has-text("Apply Filters")');

      await expect(page).toHaveURL(/lastContact=last_30_days/);
    });

    test('should filter by tags', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      await page.click('[data-testid="advanced-filters"]');

      // Select multiple tags
      await page.check('[data-testid="tag-filter-vip"]');
      await page.check('[data-testid="tag-filter-client"]');

      await page.click('button:has-text("Apply Filters")');

      // Verify filtered results have selected tags
      const contactCards = page.locator('[data-testid="contact-card"]');
      const count = await contactCards.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const card = contactCards.nth(i);
        const hasTag = await card.locator('[data-testid="tag-badge"]').count() > 0;
        expect(hasTag).toBeTruthy();
      }
    });

    test('should combine multiple filters', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      await page.click('[data-testid="advanced-filters"]');

      // Apply multiple filters
      await page.selectOption('[name="relationshipTier"]', 'VIP');
      await page.fill('[name="minRelationshipStrength"]', '8');
      await page.check('[data-testid="tag-filter-client"]');

      await page.click('button:has-text("Apply Filters")');

      // Verify all filters in URL
      await expect(page).toHaveURL(/tier=VIP/);
      await expect(page).toHaveURL(/minStrength=8/);
      await expect(page).toHaveURL(/tags=client/);
    });

    test('should save filter preset', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      await page.click('[data-testid="advanced-filters"]');

      // Apply filters
      await page.selectOption('[name="relationshipTier"]', 'VIP');

      // Save as preset
      await page.click('button:has-text("Save Preset")');
      await page.fill('[name="presetName"]', 'My VIP Contacts');
      await page.click('button:has-text("Save")');

      // Verify preset saved
      await expect(page.locator('text=Preset saved')).toBeVisible();

      // Verify preset appears in list
      await expect(page.locator('text=My VIP Contacts')).toBeVisible();
    });

    test('should load saved filter preset', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Open presets
      await page.click('[data-testid="filter-presets"]');

      // Select preset
      await page.click('button:has-text("My VIP Contacts")');

      // Verify filters applied
      await expect(page).toHaveURL(/tier=VIP/);
    });
  });

  test.describe('Search Performance', () => {
    test('should show loading state during search', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Delay search response
      await page.route('**/api/v1/search**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        });
      });

      await page.fill('[placeholder*="Search"]', 'test');

      // Verify loading indicator
      await expect(page.locator('[data-testid="search-loading"]')).toBeVisible();
    });

    test('should debounce search input', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      let requestCount = 0;
      await page.route('**/api/v1/search**', async (route) => {
        requestCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        });
      });

      // Type quickly
      await page.type('[placeholder*="Search"]', 'quick', { delay: 50 });

      // Wait for debounce
      await page.waitForTimeout(1000);

      // Should only make one request (debounced)
      expect(requestCount).toBeLessThanOrEqual(2);
    });

    test('should cache search results', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      let requestCount = 0;
      await page.route('**/api/v1/search**', async (route) => {
        requestCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        });
      });

      // Search twice with same query
      await page.fill('[placeholder*="Search"]', 'test');
      await page.waitForTimeout(500);

      await page.fill('[placeholder*="Search"]', '');
      await page.fill('[placeholder*="Search"]', 'test');

      // Should use cached results (only 1 request)
      expect(requestCount).toBe(1);
    });
  });

  test.describe('Search Results Display', () => {
    test('should highlight search terms in results', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      await page.fill('[placeholder*="Search"]', 'Software');

      // Verify highlighted text
      await expect(page.locator('mark:has-text("Software")')).toBeVisible();
    });

    test('should show result count', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      await page.fill('[placeholder*="Search"]', 'test');

      // Verify result count display
      await expect(page.locator('[data-testid="result-count"]')).toBeVisible();
      await expect(page.locator('text=/\\d+ results/i')).toBeVisible();
    });

    test('should paginate search results', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Mock large result set
      await page.route('**/api/v1/search**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: Array(50).fill(null).map((_, i) => ({
              id: `contact-${i}`,
              name: `Contact ${i}`,
            })),
            total: 50,
          }),
        });
      });

      await page.fill('[placeholder*="Search"]', 'test');

      // Verify pagination controls
      await expect(page.locator('[data-testid="pagination"]')).toBeVisible();

      // Go to next page
      await page.click('button:has-text("Next")');

      await expect(page).toHaveURL(/page=2/);
    });

    test('should show empty state for no results', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/contacts');

      // Mock no results
      await page.route('**/api/v1/search**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [], total: 0 }),
        });
      });

      await page.fill('[placeholder*="Search"]', 'nonexistent');

      // Verify empty state
      await expect(page.locator('text=No results found')).toBeVisible();
      await expect(page.locator('text=/try different keywords/i')).toBeVisible();
    });
  });
});
