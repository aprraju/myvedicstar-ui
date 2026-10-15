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
    await page.goto('/festivals');
    await expect(page.getByRole('heading', { level: 1, name: 'Festivals & Observances' })).toBeVisible();
    await expect(page).toHaveURL(/\/festivals$/);
    // The old Today address opens Home: the Panchang page.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/calendar$/);
  });

  test('there are no login or register pages', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  });

  test('dark mode keeps the page accessible', async ({ page }) => {
    await withSavedLocation(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: "Today's summary" })).toHaveCount(0);
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
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('region', { name: "Today's summary" })).toHaveCount(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('phones, signed out: the home header and menu on every public page, no app navigation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const path of ['/about', '/privacy', '/terms', '/help']) {
      await page.goto(path);
      const banner = page.getByRole('banner');
      await expect(banner.getByRole('link', { name: 'About' })).toBeHidden();
      await expect(banner.getByRole('button', { name: 'Open menu' })).toBeHidden();
      await expect(banner.getByRole('button', { name: 'Login' })).toBeVisible();
      await expect(banner.getByRole('button', { name: 'Register' })).toHaveCount(0);
      // The app's sections need sign-in, so signed-out visitors get a bottom bar of features that sign in first.
      await expect(page.getByRole('navigation', { name: 'App navigation' })).toHaveCount(0);
      // The home page's menu, fixed at the bottom: features (sign in first) and Privacy · Terms · Help · Contact.
      const bar = page.getByRole('list', { name: 'What you can do' });
      await expect(bar.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
      for (const name of ['Daily Panchang', 'Good Times', 'Festivals']) {
        await expect(bar.getByRole('button', { name })).toBeVisible();
      }
      const links = page.getByRole('navigation', { name: 'Policies and help' });
      const barBox = (await links.boundingBox())!;
      expect(barBox.y + barBox.height).toBeGreaterThan(800 - 60); // at the bottom of the screen
      await expect(links.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
      await expect(links.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
      await expect(links.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
      await expect(links.getByRole('link', { name: 'Contact' })).toHaveAttribute(
        'href',
        'mailto:contact@myvedicstar.com',
      );
    }
  });

  test('phones: the signed-out home follows the mockup and signs in from the header or the page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const banner = page.getByRole('banner');
    await expect(banner.getByRole('button', { name: 'Login' })).toBeVisible();
    // The home page carries its own menu (once — no fixed bar) and no site footer.
    await expect(page.getByRole('list', { name: 'What you can do' })).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toBeHidden();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Find Auspicious Moments for a Happier Life' }),
    ).toBeVisible();
    await expect(page.getByText('Free to get started')).toBeVisible();
    const features = page.getByRole('list', { name: 'What you can do' });
    for (const name of ['Daily Panchang', 'Good Times', 'Festivals']) {
      await expect(features.getByRole('button', { name })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      'mailto:contact@myvedicstar.com',
    );
    // The brand stays centred on the screen.
    const name = (await banner.getByText('My Vedic Star').boundingBox())!;
    expect(Math.abs(name.x + name.width / 2 - 195)).toBeLessThan(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Tall phones: the menu sits at the bottom of the screen (no empty band).
    const links = (await page.getByRole('navigation', { name: 'Policies and help' }).boundingBox())!;
    expect(844 - (links.y + links.height)).toBeLessThan(40);
    // A feature signs in like Login / Sign Up, then opens its page.
    await features.getByRole('button', { name: 'Good Times' }).click();
    await expect(page).toHaveURL(/\/good-time$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Find a Good Time' })).toHaveCount(1);
  });

  test('phones: Login / Sign Up on the home page signs in to Home (the Panchang page)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Login / Sign Up' }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(page.getByRole('navigation', { name: 'App navigation' })).toBeVisible();
  });

  test('guest header shows navigation and sign-in on wide windows', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/help');
    const banner = page.getByRole('banner');
    for (const name of ['Home', 'Features', 'About', 'Help']) {
      await expect(banner.getByRole('link', { name, exact: true })).toBeVisible();
    }
    // Sign-in entry points are buttons that go straight to the identity provider.
    for (const name of ['Login']) {
      await expect(banner.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(banner.getByRole('button', { name: 'Open menu' })).toBeHidden();
    await expect(banner.getByRole('combobox', { name: 'Tradition' })).toHaveCount(0);
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
