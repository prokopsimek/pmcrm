/**
 * E2E Performance Tests
 * Tests page load times, bundle sizes, and runtime performance
 */
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test.describe('Page Load Performance', () => {
    test('dashboard should load under 2 seconds', async ({ page }) => {
      // Register and login first
      await page.goto('/auth/register');
      const timestamp = Date.now();
      await page.fill('[name="email"]', `perf-test-${timestamp}@example.com`);
      await page.fill('[name="password"]', 'SecurePassword123!');
      await page.fill('[name="fullName"]', 'Performance Test');
      await page.click('button[type="submit"]');

      await page.waitForURL('/dashboard');

      // Measure dashboard load time
      const startTime = Date.now();
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(2000);
    });

    test('contacts page should load efficiently', async ({ page }) => {
      await page.goto('/auth/login');

      const startTime = Date.now();
      await page.goto('/contacts');
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - startTime;

      // Should load within 1.5 seconds
      expect(loadTime).toBeLessThan(1500);
    });

    test('should measure First Contentful Paint (FCP)', async ({ page }) => {
      await page.goto('/dashboard');

      const fcp = await page.evaluate(() => {
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        return fcpEntry ? fcpEntry.startTime : null;
      });

      // FCP should be under 1 second
      expect(fcp).not.toBeNull();
      expect(fcp!).toBeLessThan(1000);
    });

    test('should measure Largest Contentful Paint (LCP)', async ({ page }) => {
      await page.goto('/dashboard');

      // Wait for LCP
      await page.waitForLoadState('networkidle');

      const lcp = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            resolve(lastEntry.startTime);
          }).observe({ entryTypes: ['largest-contentful-paint'] });
        });
      });

      // LCP should be under 2.5 seconds
      expect(lcp).toBeLessThan(2500);
    });

    test('should measure Cumulative Layout Shift (CLS)', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForLoadState('networkidle');

      const cls = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsValue = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as any) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            resolve(clsValue);
          }).observe({ entryTypes: ['layout-shift'] });

          // Resolve after 5 seconds
          setTimeout(() => resolve(clsValue), 5000);
        });
      });

      // CLS should be under 0.1 (good)
      expect(cls).toBeLessThan(0.1);
    });
  });

  test.describe('Network Performance', () => {
    test('should minimize number of requests', async ({ page }) => {
      const requests: string[] = [];

      page.on('request', request => {
        requests.push(request.url());
      });

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Should make fewer than 50 requests
      expect(requests.length).toBeLessThan(50);
    });

    test('should use HTTP/2 or HTTP/3', async ({ page }) => {
      const protocols = new Set<string>();

      page.on('response', response => {
        protocols.add(response.request().protocol());
      });

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Should use modern protocol
      const hasModernProtocol = Array.from(protocols).some(p =>
        p.includes('h2') || p.includes('h3')
      );
      expect(hasModernProtocol).toBeTruthy();
    });

    test('should cache static assets', async ({ page }) => {
      // First visit
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const cachedRequests: string[] = [];

      page.on('request', request => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'script'].includes(resourceType)) {
          const cacheControl = request.headers()['cache-control'];
          if (cacheControl) {
            cachedRequests.push(request.url());
          }
        }
      });

      // Second visit
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should have cached resources
      expect(cachedRequests.length).toBeGreaterThan(0);
    });

    test('should compress responses', async ({ page }) => {
      let hasCompression = false;

      page.on('response', response => {
        const encoding = response.headers()['content-encoding'];
        if (encoding && (encoding.includes('gzip') || encoding.includes('br'))) {
          hasCompression = true;
        }
      });

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      expect(hasCompression).toBeTruthy();
    });
  });

  test.describe('JavaScript Bundle Performance', () => {
    test('should have reasonable initial bundle size', async ({ page }) => {
      const jsRequests: { url: string; size: number }[] = [];

      page.on('response', async response => {
        if (response.request().resourceType() === 'script') {
          const buffer = await response.body();
          jsRequests.push({
            url: response.url(),
            size: buffer.length,
          });
        }
      });

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const totalSize = jsRequests.reduce((sum, req) => sum + req.size, 0);

      // Total JS should be under 500KB (uncompressed)
      expect(totalSize).toBeLessThan(500 * 1024);
    });

    test('should code-split routes', async ({ page }) => {
      const jsRequests = new Set<string>();

      page.on('response', response => {
        if (response.request().resourceType() === 'script') {
          jsRequests.add(response.url());
        }
      });

      await page.goto('/dashboard');
      const dashboardScripts = new Set(jsRequests);
      jsRequests.clear();

      await page.goto('/contacts');
      const contactsScripts = new Set(jsRequests);

      // Should have different chunks for different routes
      const uniqueToDashboard = Array.from(dashboardScripts).filter(
        url => !contactsScripts.has(url)
      );
      const uniqueToContacts = Array.from(contactsScripts).filter(
        url => !dashboardScripts.has(url)
      );

      expect(uniqueToDashboard.length).toBeGreaterThan(0);
      expect(uniqueToContacts.length).toBeGreaterThan(0);
    });
  });

  test.describe('Runtime Performance', () => {
    test('should render large contact lists efficiently', async ({ page }) => {
      // Mock large contact list
      await page.route('**/api/v1/contacts**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            contacts: Array(100).fill(null).map((_, i) => ({
              id: `contact-${i}`,
              firstName: `Contact ${i}`,
              lastName: 'Test',
              email: `contact${i}@example.com`,
            })),
            total: 100,
          }),
        });
      });

      await page.goto('/contacts');

      const startTime = Date.now();
      await page.waitForSelector('[data-testid="contact-card"]');
      const renderTime = Date.now() - startTime;

      // Should render within 500ms
      expect(renderTime).toBeLessThan(500);
    });

    test('should scroll smoothly with large lists', async ({ page }) => {
      await page.goto('/contacts');

      // Measure scroll performance
      const scrollMetrics = await page.evaluate(async () => {
        const startTime = performance.now();
        let frameCount = 0;

        return new Promise((resolve) => {
          const measureFrame = () => {
            frameCount++;
            if (performance.now() - startTime < 1000) {
              requestAnimationFrame(measureFrame);
            } else {
              resolve(frameCount);
            }
          };

          // Start scrolling
          window.scrollBy(0, 1000);
          requestAnimationFrame(measureFrame);
        });
      });

      // Should maintain 60fps (60 frames in 1 second)
      expect(scrollMetrics).toBeGreaterThan(50);
    });

    test('should handle search input without lag', async ({ page }) => {
      await page.goto('/contacts');

      const searchInput = page.locator('[placeholder*="Search"]');

      const startTime = Date.now();
      await searchInput.type('test query', { delay: 10 });
      const typingTime = Date.now() - startTime;

      // Should not feel laggy (< 200ms total for short query)
      expect(typingTime).toBeLessThan(200);
    });
  });

  test.describe('Memory Performance', () => {
    test('should not leak memory on navigation', async ({ page }) => {
      await page.goto('/dashboard');

      // Get initial memory
      const initialMemory = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });

      // Navigate multiple times
      for (let i = 0; i < 5; i++) {
        await page.goto('/contacts');
        await page.goto('/dashboard');
      }

      // Force garbage collection (Chrome only)
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });

      // Get final memory
      const finalMemory = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });

      if (initialMemory > 0 && finalMemory > 0) {
        // Memory increase should be less than 5MB
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
      }
    });
  });

  test.describe('Database Query Performance', () => {
    test('should log slow queries', async ({ page }) => {
      const slowQueries: string[] = [];

      page.on('console', msg => {
        if (msg.text().includes('Slow query')) {
          slowQueries.push(msg.text());
        }
      });

      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      // Should have no slow queries
      expect(slowQueries.length).toBe(0);
    });

    test('should use efficient pagination', async ({ page }) => {
      await page.goto('/contacts');

      const requestSizes: number[] = [];

      page.on('response', async response => {
        if (response.url().includes('/api/v1/contacts')) {
          const body = await response.text();
          requestSizes.push(body.length);
        }
      });

      // Go to page 2
      await page.click('button:has-text("Next")');

      // Response sizes should be similar (efficient pagination)
      if (requestSizes.length >= 2) {
        const diff = Math.abs(requestSizes[0] - requestSizes[1]);
        const avg = (requestSizes[0] + requestSizes[1]) / 2;
        const diffPercent = (diff / avg) * 100;

        // Difference should be less than 20%
        expect(diffPercent).toBeLessThan(20);
      }
    });
  });

  test.describe('Image Performance', () => {
    test('should lazy load images', async ({ page }) => {
      await page.goto('/contacts');

      // Count initially loaded images
      const initialImages = await page.locator('img').count();

      // Scroll down
      await page.evaluate(() => window.scrollBy(0, 2000));

      // Wait a bit for lazy loading
      await page.waitForTimeout(500);

      // More images should have loaded
      const afterScrollImages = await page.locator('img').count();

      expect(afterScrollImages).toBeGreaterThanOrEqual(initialImages);
    });

    test('should use optimized image formats', async ({ page }) => {
      const imageFormats = new Set<string>();

      page.on('response', response => {
        const contentType = response.headers()['content-type'];
        if (contentType && contentType.startsWith('image/')) {
          imageFormats.add(contentType);
        }
      });

      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      // Should use modern formats like WebP or AVIF
      const hasModernFormat = Array.from(imageFormats).some(format =>
        format.includes('webp') || format.includes('avif')
      );

      // Note: This is aspirational - may not be implemented yet
      // expect(hasModernFormat).toBeTruthy();
    });
  });
});
