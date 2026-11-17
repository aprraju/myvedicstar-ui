import AxeBuilder from '@axe-core/playwright';

import { expect, panchangMonthFixture, test, withSavedLocation } from './fixtures';

test('Panchang observance badges match the legend on mobile and desktop', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await withSavedLocation(page);
  await page.goto('/calendar?month=2026-10&day=2026-10-06');
  await page.getByRole('button', { name: 'Panchang', exact: true }).click();
  const month = page.locator('section[aria-labelledby="calendar-title"]');
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const observance of ['ekadashi', 'purnima', 'amavasya']) {
      const badge = month
        .getByRole('group', { name: /Days of/ })
        .locator(`[data-observance="${observance}"]`)
        .first();
      const legend = month
        .getByRole('list', { name: 'Observances' })
        .locator(`[data-observance="${observance}"]`);
      await expect(badge).toBeVisible();
      const colors = (element: Element) => {
        const css = getComputedStyle(element);
        return [css.color, css.backgroundColor];
      };
      expect(await badge.evaluate(colors)).toEqual(await legend.evaluate(colors));
    }
  }
});

test('mobile Panchang uses backend tithi abbreviations while desktop keeps full names', async ({ page }) => {
  const response = panchangMonthFixture(2026, 9);
  response.days[0]!.tithis[0]!.shortName = 'Ekad';
  response.days[0]!.tithis[0]!.compactName = 'P11';
  await page.route('**/api/v1/panchang/month/2026/9?*', (route) => route.fulfill({ json: response }));
  await page.setViewportSize({ width: 375, height: 900 });
  await withSavedLocation(page);
  await page.goto('/calendar?month=2026-09&day=2026-09-01');
  await page.getByRole('button', { name: 'Panchang', exact: true }).click();
  const day = page.getByRole('button', { name: /^Tuesday, September 1,/ });
  await expect(day.getByText('Ekad', { exact: true })).toBeVisible();
  await expect(day.getByText('Shukla Ekadashi', { exact: true })).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(day.getByText('Shukla Ekadashi', { exact: true })).toBeVisible();
  await expect(day.getByText('Ekad', { exact: true })).toBeHidden();
});

test('desktop Calendar overlaps its banner with summary and calendar columns', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await withSavedLocation(page);
  await page.goto('/calendar');
  await expect(page.getByText('Namaste, Asha Rao')).toBeVisible();
  const summary = page.getByRole('region', { name: "Today's summary" });
  await expect(summary.getByText('Next good time')).toBeVisible();
  const calendar = page.locator('section[aria-labelledby="calendar-title"]');
  const auspicious = page.getByRole('region', { name: /^Auspicious times on \w+ \d{1,2}$/ });
  const banner = page.locator('[class*="banner"] > [class*="hero"]');
  const [s, c, a, b] = await Promise.all(
    [summary, calendar, auspicious, banner].map((item) => item.boundingBox()),
  );
  expect(s!.x + s!.width).toBeLessThanOrEqual(c!.x);
  expect(a!.y).toBeGreaterThanOrEqual(s!.y + s!.height);
  expect(c!.y).toBeLessThan(b!.y + b!.height);
  expect(s!.y).toBeLessThan(b!.y + b!.height);
  await page.screenshot({ path: '../../.verification/calendar-desktop.png', fullPage: true });
});

test('mobile pages share fixed header, bottom navigation and decision notice', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await withSavedLocation(page);
  for (const route of ['/profile', '/settings', '/calendar', '/about']) {
    await page.goto(route);
    const header = page.getByRole('banner');
    await expect(header).toBeVisible();
    // Signed in: the app's bottom bar; signed out (a public page after a reload): the sign-in features bar.
    await expect(
      page
        .getByRole('navigation', { name: 'App navigation' })
        .or(page.getByRole('list', { name: 'What you can do' })),
    ).toBeVisible();
    await page.evaluate(() => scrollTo(0, 500));
    expect((await header.boundingBox())!.y).toBe(0);
    // The footer's link columns are hidden on phones (signed-out pages keep a short Privacy · Terms · Help row).
    await expect(page.getByRole('contentinfo').getByRole('navigation', { name: 'Footer' })).toBeHidden();
    await expect(page.getByRole('contentinfo')).toContainText('Important decisions');
    if (route === '/calendar') {
      const month = page.locator('section[aria-labelledby="calendar-title"]');
      await expect(month).toBeHidden();
      await page.getByRole('button', { name: 'Panchang', exact: true }).click();
      await expect(month).toBeVisible();
      await expect(page.getByRole('region', { name: "Today's summary" })).toBeHidden();
      await month.getByRole('button', { name: /Tuesday, September 1,/ }).click();
      await expect(page).toHaveURL(/day=2026-09-01/);
      await expect(month).toBeHidden();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Tuesday, September 1', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Next day', exact: true }).click();
      await expect(page).toHaveURL(/day=2026-09-02/);
      await page.getByRole('button', { name: 'Previous day', exact: true }).click();
      await expect(page).toHaveURL(/day=2026-09-01/);
      // The Panchang card opens showing every element.
      const panchang = page.getByRole('region', { name: /^\w+ \d{1,2} Panchang$/ });
      await expect(panchang).toContainText('Yoga');
      await expect(panchang.getByRole('button', { name: 'Show less' })).toBeVisible();
      await expect(panchang.getByRole('heading')).toHaveCount(1);
      await page.locator('details > summary').filter({ hasText: 'Times to avoid' }).click();
      await expect(page.getByRole('region', { name: /^Times to avoid on \w+ \d{1,2}$/ })).toBeVisible();
      await page
        .locator('details > summary')
        .filter({ hasText: /^Why \w+ \d{1,2} is / })
        .click();
      await expect(page.getByRole('region', { name: /^Why \w+ \d{1,2} is / })).toBeVisible();
      const timeline = page.getByRole('region', { name: /^\w+ \d{1,2} timeline$/ });
      const timelineBox = await timeline.boundingBox();
      const panchangBox = await panchang.boundingBox();
      expect(timelineBox!.y + timelineBox!.height).toBeLessThanOrEqual(panchangBox!.y);
      await expect(timeline).toHaveAttribute('data-compact', 'true');
      await expect(timeline).toContainText('Next sunrise');
      await expect(timeline.getByText('Sunrise to next sunrise')).toHaveCount(0);
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(0);
  }
});

test('signed-in Home is the Panchang page: no Today item, and the old Today address opens it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await withSavedLocation(page);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/calendar$/);
  const navigation = page.getByRole('navigation', { name: 'App navigation' });
  // KUN-01: Kundali sits immediately after Good Time, mirroring the signed-in desktop nav.
  await expect(navigation.getByRole('link')).toHaveText([
    'Home',
    'Panchang',
    'Good Time',
    'Kundali',
    'Upcoming Events',
  ]);
  await expect(navigation.getByRole('link', { name: 'Today' })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/calendar');
  await navigation.getByRole('link', { name: 'Good Time' }).click();
  await expect(page).toHaveURL(/\/good-time/);
  await navigation.getByRole('link', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  // Only Panchang is highlighted on Home, so two items are never active together.
  await expect(navigation.locator('[aria-current="page"]')).toHaveText(['Panchang']);

  await page.setViewportSize({ width: 1280, height: 900 });
  const primary = page.getByRole('navigation', { name: 'Primary' });
  await expect(primary.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/calendar');
  await expect(primary.getByRole('link', { name: 'Today' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'App navigation' })).toBeHidden();
});

test('mobile Panchang remains accessible in dark mode with enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await withSavedLocation(page);
  await page.goto('/calendar');
  await expect(page.getByRole('region', { name: /^\w+ \d{1,2} Panchang$/ })).toContainText('Yoga');
  await page.evaluate(() => (document.documentElement.style.fontSize = '20px'));
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(0);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(result.violations).toEqual([]);
  await expect(page.getByRole('navigation', { name: 'App navigation' })).toBeVisible();
});

test('mobile Panchang card opens in full and folds; the account opens from the header', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await withSavedLocation(page);
  await page.goto('/calendar');
  const panchang = page.getByRole('region', { name: /^\w+ \d{1,2} Panchang$/ });
  await expect(panchang).toContainText('Yoga');
  await expect(panchang).toContainText('Karana');
  await expect(panchang.getByRole('heading')).toHaveCount(1);
  await panchang.getByRole('button', { name: 'Show less' }).click();
  await expect(panchang).not.toContainText('Karana');
  await panchang.getByRole('button', { name: 'See all' }).click();
  await expect(panchang).toContainText('Karana');
  // Five app sections in the bottom bar (KUN-01 added Kundali); the account opens from the header
  // icon as a "Your Account" sheet, so it is never a bar item.
  const navigation = page.getByRole('navigation', { name: 'App navigation' });
  await expect(navigation.getByRole('link')).toHaveCount(5);
  await expect(navigation.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('button', { name: 'Open account menu' })).toBeHidden();
  await expect(page.getByRole('banner').getByRole('button', { name: 'Open menu' })).toBeHidden();
  const account = page.getByRole('banner').getByRole('button', { name: 'Your account' });
  await account.click();
  const sheet = page.getByRole('dialog', { name: 'Your Account' });
  await expect(sheet).toContainText('Asha Rao');
  await expect(sheet).toContainText('asha.rao@example.com');
  await expect(sheet.getByRole('button', { name: 'Log out' })).toBeVisible();
  await expect(sheet.getByRole('link', { name: /^Settings/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(account).toHaveAttribute('aria-expanded', 'false');
  await expect(account).toBeFocused();
  await account.click();
  await sheet.getByRole('link', { name: /^Profile/ }).click();
  await expect(page).toHaveURL(/\/profile$/);
});
