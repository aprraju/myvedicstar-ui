import AxeBuilder from '@axe-core/playwright';

import { expect, test, withSavedLocation } from './fixtures';

test.describe('foundation', () => {
  test('home loads under the production CSP and is accessible (WCAG 2.2 AA)', async ({
    page,
    violations,
  }) => {
    const response = await page.goto('/');
    expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');

    await expect(page.getByRole('heading', { level: 1, name: /find auspicious moments/i })).toBeVisible();
    await expect(page).toHaveTitle('Home · My Vedic Star');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    expect(violations).toEqual([]);
  });

  test('skip link moves keyboard focus to the main content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('deep links work through SPA fallback and unknown routes show a 404 page', async ({ page }) => {
    await page.goto('/some/unknown/route');
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  });

  test('protected routes sign in at the identity provider and keep the destination', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('there are no login or register pages', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  });

  test('dark mode keeps the page accessible', async ({ page }) => {
    await withSavedLocation(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.getByText('Mixed day')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

test.describe('responsive layout', () => {
  // Representative widths, including narrow foldable outer displays (~344) and unfolded inner displays (~884).
  const widths = [320, 344, 360, 375, 390, 412, 430, 480, 600, 768, 820, 884, 1024, 1280, 1440, 1920];

  for (const width of widths) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await withSavedLocation(page);
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await expect(page.getByText('Mixed day')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('header collapses navigation into a menu on compact windows', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/');
    const banner = page.getByRole('banner');
    await expect(banner.getByRole('link', { name: 'About' })).toBeHidden();
    await banner.getByRole('button', { name: 'Open menu' }).click();
    await expect(banner.getByRole('link', { name: 'About' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Register' })).toBeVisible();
  });

  test('header shows navigation, location, tradition and sign-in on wide windows', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/help');
    const banner = page.getByRole('banner');
    for (const name of ['Home', 'Features', 'About', 'Help']) {
      await expect(banner.getByRole('link', { name, exact: true })).toBeVisible();
    }
    // Sign-in entry points are buttons that go straight to the identity provider.
    for (const name of ['Login', 'Register']) {
      await expect(banner.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(banner.getByRole('button', { name: 'Open menu' })).toBeHidden();
    await expect(banner.getByRole('combobox', { name: 'Tradition' })).toBeVisible();
  });

  test('home page header has no tradition selector and no GeoNames footer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('combobox', { name: 'Tradition' })).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).not.toContainText('GeoNames');
  });

  test('text remains usable at 200% zoom-equivalent (320 CSS px)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/help');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
