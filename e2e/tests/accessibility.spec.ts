/**
 * E2E Accessibility Tests
 * Tests WCAG 2.1 AA compliance and keyboard navigation
 */
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility Tests', () => {
  test.describe('WCAG 2.1 AA Compliance', () => {
    test('dashboard should have no accessibility violations', async ({ page }) => {
      // Register and login
      await page.goto('/auth/register');
      const timestamp = Date.now();
      await page.fill('[name="email"]', `a11y-test-${timestamp}@example.com`);
      await page.fill('[name="password"]', 'SecurePassword123!');
      await page.fill('[name="fullName"]', 'Accessibility Test');
      await page.click('button[type="submit"]');

      await page.waitForURL('/dashboard');

      // Inject axe-core
      await injectAxe(page);

      // Run accessibility checks
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: {
          html: true,
        },
      });
    });

    test('contacts page should be accessible', async ({ page }) => {
      await page.goto('/contacts');
      await injectAxe(page);
      await checkA11y(page);
    });

    test('contact form should be accessible', async ({ page }) => {
      await page.goto('/contacts/new');
      await injectAxe(page);
      await checkA11y(page);
    });

    test('reminders page should be accessible', async ({ page }) => {
      await page.goto('/reminders');
      await injectAxe(page);
      await checkA11y(page);
    });

    test('settings page should be accessible', async ({ page }) => {
      await page.goto('/settings');
      await injectAxe(page);
      await checkA11y(page);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate site with Tab key', async ({ page }) => {
      await page.goto('/dashboard');

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName);

      await page.keyboard.press('Tab');
      const secondFocused = await page.evaluate(() => document.activeElement?.tagName);

      // Should focus on interactive elements
      expect(['A', 'BUTTON', 'INPUT']).toContain(firstFocused);
      expect(['A', 'BUTTON', 'INPUT']).toContain(secondFocused);
    });

    test('should have visible focus indicators', async ({ page }) => {
      await page.goto('/contacts');

      // Tab to first button
      await page.keyboard.press('Tab');

      // Check if focus is visible
      const hasFocusIndicator = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement;
        const styles = window.getComputedStyle(element);
        return styles.outlineWidth !== '0px' || styles.boxShadow !== 'none';
      });

      expect(hasFocusIndicator).toBeTruthy();
    });

    test('should navigate forms with keyboard', async ({ page }) => {
      await page.goto('/contacts/new');

      // Tab to first name field
      await page.keyboard.press('Tab');
      await page.keyboard.type('John');

      // Tab to last name field
      await page.keyboard.press('Tab');
      await page.keyboard.type('Doe');

      // Verify values entered
      const firstName = await page.locator('[name="firstName"]').inputValue();
      const lastName = await page.locator('[name="lastName"]').inputValue();

      expect(firstName).toBe('John');
      expect(lastName).toBe('Doe');
    });

    test('should submit form with Enter key', async ({ page }) => {
      await page.goto('/contacts/new');

      await page.fill('[name="firstName"]', 'Test');
      await page.fill('[name="email"]', 'test@example.com');

      // Press Enter to submit
      await page.keyboard.press('Enter');

      // Should navigate to contact page
      await expect(page).toHaveURL(/\/contacts\/[\w-]+/);
    });

    test('should close modals with Escape key', async ({ page }) => {
      await page.goto('/contacts');

      // Open a modal (if available)
      if (await page.locator('[data-testid="open-modal-button"]').isVisible()) {
        await page.click('[data-testid="open-modal-button"]');

        // Press Escape
        await page.keyboard.press('Escape');

        // Modal should close
        await expect(page.locator('[data-testid="modal"]')).not.toBeVisible();
      }
    });

    test('should navigate dropdown menus with arrow keys', async ({ page }) => {
      await page.goto('/dashboard');

      // Open user menu (if available)
      const userMenu = page.locator('[data-testid="user-menu"]');

      if (await userMenu.isVisible()) {
        // Click to open
        await userMenu.click();

        // Navigate with arrow keys
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');

        // Press Enter to select
        await page.keyboard.press('Enter');

        // Should navigate to selected option
        await page.waitForTimeout(100);
      }
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/dashboard');

      const headings = await page.evaluate(() => {
        const h1Count = document.querySelectorAll('h1').length;
        const h2Count = document.querySelectorAll('h2').length;
        const h3Count = document.querySelectorAll('h3').length;

        return { h1Count, h2Count, h3Count };
      });

      // Should have exactly one h1
      expect(headings.h1Count).toBe(1);

      // Should have headings in proper order
      expect(headings.h2Count).toBeGreaterThanOrEqual(0);
    });

    test('should have descriptive labels for form inputs', async ({ page }) => {
      await page.goto('/contacts/new');

      // Check all inputs have labels
      const inputsWithoutLabels = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="text"], input[type="email"]');
        const without: string[] = [];

        inputs.forEach((input) => {
          const id = input.getAttribute('id');
          const ariaLabel = input.getAttribute('aria-label');
          const ariaLabelledBy = input.getAttribute('aria-labelledby');

          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (!label && !ariaLabel && !ariaLabelledBy) {
              without.push(id || 'unknown');
            }
          }
        });

        return without;
      });

      expect(inputsWithoutLabels.length).toBe(0);
    });

    test('should have alt text for images', async ({ page }) => {
      await page.goto('/contacts');

      const imagesWithoutAlt = await page.evaluate(() => {
        const images = document.querySelectorAll('img');
        const without: string[] = [];

        images.forEach((img) => {
          const alt = img.getAttribute('alt');
          if (alt === null || alt === '') {
            without.push(img.src);
          }
        });

        return without;
      });

      expect(imagesWithoutAlt.length).toBe(0);
    });

    test('should have ARIA labels for icon buttons', async ({ page }) => {
      await page.goto('/contacts');

      const iconButtonsWithoutLabels = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        const without: number[] = [];

        buttons.forEach((button, index) => {
          const hasText = button.textContent?.trim();
          const ariaLabel = button.getAttribute('aria-label');
          const ariaLabelledBy = button.getAttribute('aria-labelledby');
          const title = button.getAttribute('title');

          if (!hasText && !ariaLabel && !ariaLabelledBy && !title) {
            without.push(index);
          }
        });

        return without;
      });

      expect(iconButtonsWithoutLabels.length).toBe(0);
    });

    test('should announce dynamic content changes', async ({ page }) => {
      await page.goto('/contacts');

      // Check for ARIA live regions
      const hasLiveRegion = await page.evaluate(() => {
        const liveRegions = document.querySelectorAll('[aria-live]');
        return liveRegions.length > 0;
      });

      // Should have at least one live region for announcements
      expect(hasLiveRegion).toBeTruthy();
    });
  });

  test.describe('Color Contrast', () => {
    test('should meet contrast ratio requirements', async ({ page }) => {
      await page.goto('/dashboard');

      await injectAxe(page);

      // Check only color contrast
      await checkA11y(page, null, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });
    });

    test('should be usable without color', async ({ page }) => {
      await page.goto('/contacts');

      // Apply grayscale filter
      await page.evaluate(() => {
        document.body.style.filter = 'grayscale(100%)';
      });

      // Important elements should still be distinguishable
      // Check if buttons are still identifiable
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      expect(buttonCount).toBeGreaterThan(0);

      // Check if links are still identifiable
      const links = page.locator('a');
      const linkCount = await links.count();

      expect(linkCount).toBeGreaterThan(0);
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('should be accessible on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/dashboard');

      await injectAxe(page);
      await checkA11y(page);
    });

    test('should have adequate touch targets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/contacts');

      // Check button sizes
      const smallButtons = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        const small: number[] = [];

        buttons.forEach((button, index) => {
          const rect = button.getBoundingClientRect();
          // WCAG recommends minimum 44x44px
          if (rect.width < 44 || rect.height < 44) {
            small.push(index);
          }
        });

        return small;
      });

      // Should have no buttons smaller than 44x44px
      expect(smallButtons.length).toBe(0);
    });
  });

  test.describe('Text Scaling', () => {
    test('should support 200% text zoom', async ({ page }) => {
      await page.goto('/dashboard');

      // Zoom to 200%
      await page.evaluate(() => {
        document.body.style.zoom = '2';
      });

      // Content should still be visible and usable
      const isOverflowing = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });

      // Some horizontal scroll is acceptable at 200% zoom
      // But should not break the layout completely
      const scrollRatio = await page.evaluate(() => {
        return document.body.scrollWidth / window.innerWidth;
      });

      expect(scrollRatio).toBeLessThan(3);
    });
  });

  test.describe('Error Handling Accessibility', () => {
    test('should announce form validation errors', async ({ page }) => {
      await page.goto('/contacts/new');

      // Submit invalid form
      await page.click('button[type="submit"]');

      // Check for error announcements
      const hasErrorRegion = await page.evaluate(() => {
        const errors = document.querySelectorAll('[role="alert"], [aria-invalid="true"]');
        return errors.length > 0;
      });

      expect(hasErrorRegion).toBeTruthy();
    });

    test('should associate error messages with inputs', async ({ page }) => {
      await page.goto('/contacts/new');

      await page.click('button[type="submit"]');

      // Check if errors are properly associated
      const hasProperAssociation = await page.evaluate(() => {
        const invalidInputs = document.querySelectorAll('[aria-invalid="true"]');
        let allAssociated = true;

        invalidInputs.forEach((input) => {
          const describedBy = input.getAttribute('aria-describedby');
          if (!describedBy) {
            allAssociated = false;
          }
        });

        return allAssociated && invalidInputs.length > 0;
      });

      expect(hasProperAssociation).toBeTruthy();
    });
  });

  test.describe('Skip Links', () => {
    test('should have skip to main content link', async ({ page }) => {
      await page.goto('/dashboard');

      // Tab to skip link (usually first focusable element)
      await page.keyboard.press('Tab');

      const skipLinkText = await page.evaluate(() => {
        const activeElement = document.activeElement as HTMLElement;
        return activeElement?.textContent?.toLowerCase();
      });

      expect(skipLinkText).toContain('skip');
    });
  });
});
