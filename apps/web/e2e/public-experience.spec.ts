import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, test, withSavedLocation } from './fixtures';

const card = (page: Page) => page.getByRole('region', { name: "Today's summary" });

test.describe('public home', () => {
  test('shows today for the saved location: day, good time, next caution', async ({ page, apiRequests }) => {
    await withSavedLocation(page);
    await page.goto('/');
    await expect(card(page).getByText('Mixed day')).toBeVisible();
    await expect(card(page)).toContainText('Tuesday, September 29');
    // Today's embedded evaluation has no Good Time; no separate evaluation is requested.
    await expect(card(page)).toContainText('No more recommended times today');
    await expect(card(page)).toContainText(/Use caution now\s*Durmuhurtham/);
    await expect(card(page)).toContainText('All times shown in local time — Austin, Texas');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    expect(
      apiRequests.every(
        (u) => u.pathname.endsWith('/panchang/today') || u.pathname.endsWith('/locations/resolve'),
      ),
    ).toBe(true);
    await expect(page.getByRole('button', { name: 'Register' })).toHaveCount(0);
  });

  test('uses the current location when the browser allows it', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 30.2672, longitude: -97.7431 });
    await page.goto('/');
    await expect(card(page)).toContainText('All times shown in local time — Austin, Texas');
    await expect(page.getByRole('button', { name: 'Change location: Austin, Texas' })).toBeVisible();
  });

  test('works without location permission and offers manual search', async ({ page, context }) => {
    await context.clearPermissions();
    await page.goto('/');
    await expect(card(page).getByText('Choose a location to see today’s Panchang')).toBeVisible();
    await card(page).getByRole('button', { name: 'Choose location' }).click();
    await expect(page.getByRole('dialog', { name: 'Choose your location' })).toBeVisible();
  });

  test('change location → Panchang updates', async ({ page, apiRequests }) => {
    await withSavedLocation(page);
    await page.goto('/');
    await expect(card(page).getByText('Mixed day')).toBeVisible();

    await page.getByRole('button', { name: 'Change location: Austin, Texas' }).click();
    const dialog = page.getByRole('dialog', { name: 'Choose your location' });
    const results = await new AxeBuilder({ page }).include('dialog').withTags(['wcag2aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);

    await dialog
      .getByRole('searchbox', { name: 'City, ZIP code or coordinates' })
      .fill('Hyderabad, Telangana, India');
    await dialog.getByRole('button', { name: 'Search' }).click();
    await dialog.getByRole('button', { name: 'Use this location' }).click();

    await expect(dialog).toBeHidden();
    await expect(card(page)).toContainText('All times shown in local time — Hyderabad, Telangana');
    // 10:00 in Austin is 20:30 in Hyderabad: today's embedded evaluation has no Good Time, and times are shown in the
    // selected location's zone (IST), not the browser's.
    await expect(card(page)).toContainText('No more recommended times today');
    await expect(card(page)).toContainText(/Next caution period\s*Dur Muhurtam 10:54\sPM – 11:42\sPM/);
    expect(
      apiRequests.some(
        (u) => u.pathname.endsWith('/panchang/today') && u.searchParams.get('latitude') === '17.39',
      ),
    ).toBe(true);
  });

  test('explains an unsupported ZIP search', async ({ page }) => {
    await withSavedLocation(page);
    await page.goto('/');
    await page.getByRole('button', { name: /Change location/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('searchbox').fill('78701');
    await dialog.getByRole('button', { name: 'Search' }).click();
    await expect(dialog.getByRole('alert')).toContainText('ZIP or postal code isn’t available yet');
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
    await page.getByRole('banner').getByRole('button', { name: 'Register' }).click();
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
    await page.goto('/');
    await card(page).getByRole('link', { name: 'Find a Good Time' }).click();
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
    await page.goto('/good-time?activity=business&view=month&month=2026-10');
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
    if (page.viewportSize()!.width < 1024) {
      const calendarBounds = await page
        .getByRole('heading', { level: 2, name: 'October 2026' })
        .boundingBox();
      const tileBounds = await tile.boundingBox();
      expect(calendarBounds!.y).toBeLessThan(tileBounds!.y);
    }

    await tile.getByRole('button', { name: /View .*October 12/ }).click();
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
