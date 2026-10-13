import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, test, withSavedLocation } from './fixtures';

const card = (page: Page) => page.getByRole('region', { name: "Today's summary" });

test.describe('public home', () => {
  test('signed-out home has no Today card or application API calls', async ({
    page,
    apiRequests,
    context,
  }) => {
    await withSavedLocation(page);
    await context.grantPermissions(['geolocation']);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /find auspicious moments/i })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Change location/ })).toHaveCount(0);
    expect(apiRequests).toHaveLength(0);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((result) => result.id)).toEqual([]);
  });

  test('logout return with sid stays on the signed-out landing page without API requests', async ({
    page,
    apiRequests,
  }) => {
    await page.goto('/?sid=logout-test-session');
    await expect(page.getByRole('heading', { level: 1, name: /find auspicious moments/i })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    expect(apiRequests).toHaveLength(0);
  });

  test('change tradition → Panchang requested for the new tradition', async ({ page, apiRequests }) => {
    // The tradition selector is not shown on the home page; choose it elsewhere, then return home.
    await withSavedLocation(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await page.getByRole('link', { name: 'Help / FAQ', exact: true }).click();
    await page.getByRole('combobox', { name: 'Tradition' }).selectOption('tamil');
    await page.getByRole('link', { name: "Today's Panchang", exact: true }).click();
    await expect(card(page).getByText('Mixed day')).toBeVisible();
    await expect
      .poll(() =>
        apiRequests.some(
          (u) => u.pathname.endsWith('/panchang/today') && u.searchParams.get('tradition') === 'tamil',
        ),
      )
      .toBe(true);
    await page.getByRole('link', { name: 'Help / FAQ', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Tradition' })).toHaveValue('tamil');
  });

  test('Features link scrolls to the feature overview', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/about');
    await page.getByRole('banner').getByRole('link', { name: 'Features' }).click();
    await expect(page.getByRole('region', { name: 'Everything You Need in One Place' })).toBeInViewport();
  });
});

test.describe('sign-in journeys (mock identity provider)', () => {
  test('Home → Login → Dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const banner = page.getByRole('banner');
    // On phones Login lives in the menu.
    const menu = banner.getByRole('button', { name: 'Open menu' });
    if (await menu.isVisible()) await menu.click();
    // Login goes straight to the identity provider (mock: signs in instantly), then to the dashboard.
    await banner.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('Help → Register → Dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/help');
    await page.getByRole('banner').getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('every API call made by the dashboard carries the access token', async ({ page }) => {
    await withSavedLocation(page);
    const calls: { path: string; authorization: string | undefined }[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/v1/')) {
        calls.push({ path: url.pathname, authorization: request.headers()['authorization'] });
      }
    });
    await page.goto('/dashboard'); // mock identity provider signs in instantly
    await expect(page.getByRole('region', { name: 'Times to avoid' })).toBeVisible();
    await expect
      .poll(() => calls.map((c) => c.path))
      .toEqual(expect.arrayContaining(['/api/v1/panchang/today', '/api/v1/traditions']));
    // Once signed in, every endpoint is (re)requested with the token: the latest call to each carries it.
    await expect
      .poll(() => {
        const latest = new Map(calls.map((call) => [call.path, call.authorization]));
        return [...latest.values()].every((value) => value === 'Bearer mock-access-token');
      })
      .toBe(true);
  });

  test('Find a Good Time → sign in → back to Find a Good Time', async ({ page }) => {
    await withSavedLocation(page);
    await page.goto('/good-time');
    await expect(page.getByRole('heading', { level: 1, name: 'Find a Good Time' })).toBeVisible();
    await expect(page).toHaveURL(/\/good-time$/);
  });
});

test.describe('calendar (signed in)', () => {
  test('month view: observances, selecting a day, moving months — with the access token', async ({
    page,
  }) => {
    await withSavedLocation(page);
    const monthCalls: (string | undefined)[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/panchang/month/')) monthCalls.push(request.headers()['authorization']);
    });
    await page.goto('/calendar?month=2026-10'); // mock identity provider signs in instantly
    await expect(page.getByRole('heading', { level: 1, name: 'October 2026' })).toBeVisible();
    const grid = page.getByRole('group', { name: 'Days of October 2026' });
    await expect(grid.getByRole('button', { name: /^Tuesday, October 20,.*Vijayadashami/ })).toBeVisible();
    const festivalDay = grid.getByRole('button', { name: /^Tuesday, October 20,.*Vijayadashami/ });
    await expect(festivalDay.getByText('Amavasya', { exact: true })).toBeVisible();
    await expect(festivalDay.getByText(/Vijayadashami \(Dasara\)/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await grid.screenshot({ path: test.info().outputPath('calendar-month.png') });

    await grid.getByRole('button', { name: /^Tuesday, October 20,/ }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Tuesday, October 20', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Panchang' })).toContainText('Amavasya');
    await expect(page).toHaveURL(/day=2026-10-20/);

    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'November 2026' })).toBeVisible();
    await expect.poll(() => monthCalls.length).toBeGreaterThanOrEqual(2);
    expect(monthCalls.at(-1)).toBe('Bearer mock-access-token');
  });
});

test.describe('find a good time (signed in)', () => {
  test('month view stays selected and precedes other cards on mobile', async ({ page }) => {
    await withSavedLocation(page);
    await page.goto('/good-time?activity=business&view=month&month=2026-10&date=2026-10-01');
    await expect(page.getByRole('heading', { level: 2, name: 'October 2026' })).toBeVisible();
    const grid = page.getByRole('group', { name: 'Days of October 2026' });
    await expect(grid.getByRole('button', { name: /^Thursday, October 1,.*Highly Favorable/ })).toBeVisible();

    const tile = page.getByRole('complementary', { name: 'Next best times' });
    await expect(tile.getByRole('listitem').first()).toContainText('Highly Favorable');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await grid.getByRole('button', { name: /^Sunday, October 4,/ }).click();
    await expect(page).toHaveURL(/date=2026-10-04/);
    await expect(page.getByRole('radio', { name: 'Month' })).toBeChecked();
    await expect(grid.getByRole('button', { name: /^Sunday, October 4,/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('region', { name: 'Recommended time', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Not recommended', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'In brief', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'The day at a glance', exact: true })).toBeVisible();
    if (page.viewportSize()!.width < 1024) {
      const calendarBounds = await page
        .getByRole('heading', { level: 2, name: 'October 2026' })
        .boundingBox();
      const tileBounds = await tile.boundingBox();
      expect(calendarBounds!.y).toBeLessThan(tileBounds!.y);
    }

    await grid.getByRole('button', { name: /^Monday, October 12,/ }).click();
    await expect(page).toHaveURL(/date=2026-10-12/);
    await expect(page.getByRole('radio', { name: 'Month' })).toBeChecked();
    await page.getByRole('radio', { name: 'Day' }).click();
    await expect(page.getByRole('radio', { name: 'Day' })).toBeChecked();
  });
});

test.describe('festivals and account (signed in)', () => {
  test('upcoming festivals load with the access token; the profile menu shows the user from userinfo', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await withSavedLocation(page);
    const calls: { path: string; method: string; authorization: string | undefined }[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (/\/(festivals\/upcoming|auth\/userinfo)$/.test(url.pathname)) {
        calls.push({
          path: url.pathname,
          method: request.method(),
          authorization: request.headers()['authorization'],
        });
      }
    });
    await page.goto('/festivals'); // mock identity provider signs in instantly
    await expect(page.getByRole('heading', { level: 1, name: 'Festivals & Observances' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Vijayadashami (Dasara)' })).toBeVisible();

    const banner = page.getByRole('banner');
    await banner.getByRole('button', { name: 'Open account menu' }).click();
    await expect(banner.getByText('Asha Rao')).toBeVisible();
    await expect(banner.getByText('asha.rao@example.com')).toBeVisible();
    await expect(banner.getByRole('link', { name: 'Settings' })).toBeVisible();

    const festivals = calls.find((c) => c.path.endsWith('/festivals/upcoming'));
    const userinfo = calls.filter((c) => c.path.endsWith('/auth/userinfo'));
    expect(festivals?.authorization).toBe('Bearer mock-access-token');
    expect(userinfo).toHaveLength(1);
    expect(userinfo[0]).toMatchObject({ method: 'POST', authorization: 'Bearer mock-access-token' });
  });
});
