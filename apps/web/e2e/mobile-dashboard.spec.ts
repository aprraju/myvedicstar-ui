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
        .getByRole('navigation', { name: 'Today navigation' })
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
      const panchang = page.getByRole('region', { name: /^\w+ \d{1,2} Panchang$/ });
      await panchang.getByRole('button', { name: 'See all' }).click();
      await expect(panchang).toContainText('Yoga');
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

test('desktop Today preserves its approved layout', async ({ page }, info) => {
  test.setTimeout(60000);
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop visual reference.');
  await page.setViewportSize({ width: 1280, height: 900 });
  await withSavedLocation(page);
  await page.goto('/dashboard');
  await expect(page.getByText('Namaste, Asha Rao')).toBeVisible();
  await expect(
    page.getByRole('region', { name: "Today's summary" }).getByText('Mixed', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: /^Times to avoid on \w+ \d{1,2}$/ })).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // Font rasterization differs by OS; this reviewed baseline was captured on Windows.
  if (process.platform === 'win32')
    await expect(page).toHaveScreenshot('desktop-today.png', { fullPage: true });
  await expect(page.getByRole('navigation', { name: 'Today navigation' })).toHaveCount(0);
});

test('mobile Today follows the mockup order and fits phones, tablets and unfolded windows', async ({
  page,
  apiRequests,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 375, height: 900 });
  await withSavedLocation(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('banner').getByRole('combobox', { name: 'Tradition' })).toBeVisible();
  await expect(page.getByText('Namaste, Asha', { exact: true })).toHaveCount(0);
  const header = page.getByRole('banner');
  await expect(header.getByRole('button', { name: 'Open account menu' })).toBeHidden();
  await page.evaluate(() => scrollTo(0, 500));
  expect((await header.boundingBox())!.y).toBe(0);
  await page.evaluate(() => scrollTo(0, 0));
  const summary = page.getByRole('region', { name: "Today's summary" });
  await expect(summary.getByText('Mixed', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('contentinfo')
      .getByText('Important decisions should not rely solely on information provided by MyVedicStar.'),
  ).toBeVisible();
  await expect(page.getByRole('contentinfo').getByRole('navigation')).toBeHidden();
  await expect(page.locator('[class*="dayDate"]')).toBeVisible();
  await expect(page.locator('[class*="dayContext"]')).toContainText('Paksha');
  const timeline = page.getByRole('region', { name: /^\w+ \d{1,2} timeline$/ });
  const auspicious = page.getByRole('region', { name: /^Auspicious times on \w+ \d{1,2}$/ });
  const panchang = page.getByRole('region', { name: /^\w+ \d{1,2} Panchang$/ });
  for (const width of [320, 375, 430, 600, 884]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(0);
    const facts = await summary.locator('dl > div').all();
    expect(facts).toHaveLength(2);
    const [left, right] = await Promise.all(facts.map((fact) => fact.boundingBox()));
    expect(Math.abs(left!.height - right!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(left!.y - right!.y)).toBeLessThanOrEqual(1);
    const boxes = await Promise.all(
      [summary, timeline, auspicious, panchang].map((section) => section.boundingBox()),
    );
    expect(boxes.map((box) => box!.y)).toEqual([...boxes.map((box) => box!.y)].sort((a, b) => a - b));
    const header = await page.getByRole('banner').boundingBox();
    expect(header!.y).toBe(0);
    expect(boxes[0]!.y).toBeGreaterThanOrEqual(header!.height);
    const subtitle = await timeline.getByRole('heading').boundingBox();
    const now = await timeline.getByText('Now', { exact: true }).boundingBox();
    expect(now!.y).toBeGreaterThanOrEqual(subtitle!.y + subtitle!.height + 4);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(result.violations).toEqual([]);
  expect(apiRequests.filter((url) => url.pathname.endsWith('/panchang/today'))).toHaveLength(1);
  if (process.platform === 'win32')
    await expect(page).toHaveScreenshot('mobile-today.png', { fullPage: true });
});

test('mobile Today remains accessible in dark mode with enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await withSavedLocation(page);
  await page.goto('/dashboard');
  await expect(
    page.getByRole('region', { name: "Today's summary" }).getByText('Mixed', { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => (document.documentElement.style.fontSize = '20px'));
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(0);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(result.violations).toEqual([]);
  await expect(page.getByRole('navigation', { name: 'Today navigation' })).toBeVisible();
});

test('mobile previews retain complete periods, Panchang, explanations and Profile navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await withSavedLocation(page);
  await page.goto('/dashboard');
  const panchang = page.getByRole('region', { name: /^\w+ \d{1,2} Panchang$/ });
  await panchang.getByRole('button', { name: /^Tithi:/ }).click();
  await expect(panchang).toContainText('Yoga');
  await expect(panchang).toContainText('Karana');
  await expect(panchang.getByRole('heading')).toHaveCount(1);
  await expect(panchang.locator('dl')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Complete Panchang' })).toHaveCount(0);
  await panchang.getByRole('button', { name: 'Show less' }).click();
  await panchang.getByRole('button', { name: 'See all' }).click();
  await expect(panchang).toContainText('Yoga');
  const auspicious = page.getByRole('region', { name: /^Auspicious times on \w+ \d{1,2}$/ });
  await expect(auspicious).toContainText('Overlaps with');
  await auspicious.getByRole('button', { name: 'See all' }).click();
  await expect(auspicious.getByRole('button', { name: 'Show less' })).toBeVisible();
  await page.getByRole('button', { name: 'View timeline details' }).click();
  await expect(page.getByRole('region', { name: /^Times to avoid on \w+ \d{1,2}$/ }).first()).toContainText(
    'Rahu Kalam',
  );
  await page
    .locator('details > summary')
    .filter({ hasText: /^Why \w+ \d{1,2} is / })
    .click();
  await expect(page.locator('details[open]')).toContainText('Tithi');
  // Four app sections in the bottom bar; the account opens from the header's icon as a "Your Account" sheet.
  const navigation = page.getByRole('navigation', { name: 'Today navigation' });
  await expect(navigation.getByRole('link')).toHaveCount(4);
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
