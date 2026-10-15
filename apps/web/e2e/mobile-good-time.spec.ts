import { createRequire } from 'node:module';

import AxeBuilder from '@axe-core/playwright';
import type { GoodTimesResponse } from '@myvedicstar/contracts';
import type { Page } from '@playwright/test';

import { expect, test, withSavedLocation } from './fixtures';

// Playwright loads specs as native ESM, where JSON needs import attributes; read the shared fixture with require.
const businessDay = createRequire(import.meta.url)(
  '../../../packages/testing/src/fixtures/muhurta-good-times-austin-business-2026-10-01.json',
) as GoodTimesResponse;

const NAKSHATRAS = [
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashira',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'Purva Phalguni',
  'Uttara Phalguni',
  'Hasta',
  'Chitra',
  'Swati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Mula',
  'Purva Ashadha',
  'Uttara Ashadha',
  'Shravana',
  'Dhanishta',
  'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada',
  'Revati',
];

const accessible = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((item) => item.id)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
};

test.describe('Find a Good Time on phones', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withSavedLocation(page);
    // The full catalog of 27 stars, so the birth star list has to scroll.
    await page.route('**/api/v1/muhurta/nakshatras', (route) =>
      route.fulfill({
        json: {
          language: 'en',
          nakshatras: NAKSHATRAS.map((name, i) => ({ key: name, name, order: i + 1 })),
        },
      }),
    );
  });

  test('search → Find → results with edit card, best time, next best days and the day at a glance', async ({
    page,
  }) => {
    test.setTimeout(60_000); // the whole flow, with three accessibility scans
    await page.goto('/good-time?activity=business&date=2026-10-01');
    await expect(page.getByRole('heading', { level: 1, name: 'Find a Good Time' })).toBeVisible();
    await expect(page.getByText('Find an auspicious time for what matters.')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Business' })).toHaveAttribute('aria-checked', 'true');
    // Birth star: a compact dropdown under the field that scrolls inside itself (27 stars).
    const star = page.getByRole('button', { name: /^Birth star \(optional\)/ });
    await expect(star).toHaveAccessibleName('Birth star (optional) None — General recommendations');
    await star.click();
    const list = page.getByRole('listbox', { name: /^Birth star/ });
    await expect(list).toBeVisible();
    await expect(list.getByRole('option')).toHaveCount(28);
    await expect(list.getByRole('option', { name: 'None — General recommendations' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const listBox = (await list.boundingBox())!;
    const starBox = (await star.boundingBox())!;
    expect(listBox.y).toBeGreaterThanOrEqual(starBox.y + starBox.height); // opens below the field
    expect(listBox.height).toBeLessThan(260); // about five rows
    expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await accessible(page);
    await page.screenshot({ path: test.info().outputPath('birth-star-dropdown.png') });
    await list.getByRole('option', { name: 'Revati' }).scrollIntoViewIfNeeded();
    await list.getByRole('option', { name: 'Ashwini' }).click();
    await expect(list).toBeHidden();
    await expect(star).toBeFocused();
    await expect(star).toHaveAccessibleName('Birth star (optional) Ashwini');
    await expect(page).toHaveURL(/nakshatra=Ashwini/);

    // Compact date picker; Calendar expands the month, choosing a day collapses it again.
    const picker = page.getByRole('group', { name: 'Date' });
    await expect(picker).toContainText('Thursday, October 1');
    // Changing the date keeps the page where it is (no jump to the top).
    await page.evaluate(() => window.scrollTo(0, 250));
    const scrolled = await page.evaluate(() => window.scrollY);
    expect(scrolled).toBeGreaterThan(0);
    await picker.getByRole('button', { name: 'Next day' }).click();
    await expect(page).toHaveURL(/date=2026-10-02/);
    await expect(picker).toContainText('Friday, October 2');
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
    const panchang = page.getByRole('button', { name: 'Panchang', exact: true });
    await expect(panchang).toHaveAttribute('aria-pressed', 'false');
    await panchang.click();
    const grid = page.getByRole('group', { name: 'Days of October 2026' });
    await expect(grid).toBeVisible();
    await expect(panchang).toHaveAttribute('aria-pressed', 'true');
    await grid.screenshot({ path: test.info().outputPath('month.png') });
    await grid.getByRole('button', { name: /^Thursday, October 1,/ }).click();
    await expect(grid).toBeHidden();
    await expect(page).toHaveURL(/date=2026-10-01/);
    await expect(picker).toContainText('Thursday, October 1');
    await accessible(page);
    await page.screenshot({ path: test.info().outputPath('search.png'), fullPage: true });

    await page.getByRole('button', { name: 'Find good times' }).click();
    await expect(page).toHaveURL(/step=results/);

    const summary = page.getByRole('region', { name: 'Your search' });
    await expect(summary).toContainText('Business');
    await expect(summary).toContainText('Ashwini');
    await expect(summary).toContainText('Oct 1 – 30, 2026');
    await expect(summary).toContainText('(Next 30 days)');
    await expect(page.getByText(/consult a qualified astrologer/)).toHaveCount(0);

    await expect(page.getByRole('heading', { level: 2, name: /day$/ }).first()).toBeVisible();
    const best = page.getByRole('region', { name: 'Best recommended time' });
    await expect(best).toBeVisible();
    await expect(best.getByRole('heading', { name: 'Best recommended time' })).toHaveCSS(
      'text-transform',
      'none',
    );
    const why = best.getByRole('button', { name: 'Why is this time recommended?' });
    await expect(why).toHaveAttribute('aria-expanded', 'false');
    await why.click();
    await expect(why).toHaveAttribute('aria-expanded', 'true');
    await expect(best.locator('ul li').first()).toBeVisible();

    // Not recommended times below the recommended time (the business day has favorable periods that overlap an avoid).
    const notRecommended = page.getByRole('region', { name: 'Not recommended times' });
    await expect(notRecommended).toBeVisible();
    const row = notRecommended.getByRole('button').first();
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    await expect(notRecommended).toContainText('⚠');
    const bestBox = (await best.boundingBox())!;
    expect((await notRecommended.boundingBox())!.y).toBeGreaterThan(bestBox.y);

    const next = page.getByRole('region', { name: 'Next best days' });
    const range = next.getByRole('button', { name: /^Search range:/ });
    await expect(range).toHaveAccessibleName('Search range: Next 30 days');
    await expect(next.getByRole('listitem')).toHaveCount(2);
    // Before any choice, the day's best time (shown above) is already highlighted.
    await expect(next.getByRole('button', { name: /^View Thursday, October 1,/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await next.getByRole('button', { name: 'View all recommended times' }).click();
    expect(await next.getByRole('listitem').count()).toBeGreaterThan(2);
    await next.getByRole('button', { name: 'Show fewer' }).click();
    await expect(next.getByRole('listitem')).toHaveCount(2);

    const glance = page.getByRole('button', { name: 'Day at a glance' });
    await glance.click();
    await expect(glance).toHaveAttribute('aria-expanded', 'true');
    // Expanded, only the Timeline card is shown (no second summary bar).
    await expect(page.locator('[class*="glanceBar"]')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'October 1 timeline' })).toBeVisible();
    await expect(page.locator('details > summary').filter({ hasText: 'Times to avoid' })).toBeVisible();
    await accessible(page);
    await page.screenshot({ path: test.info().outputPath('results.png'), fullPage: true });

    // A next best time shows that day and time in detail; the searched range stays the same.
    await next.getByRole('button', { name: 'View all recommended times' }).click();
    const option = next.getByRole('button', { name: /^View Thursday, October 1,/ });
    await option.click();
    await expect(page).toHaveURL(/at=2026-10-01T08%3A53%3A27/);
    await expect(page.getByRole('region', { name: 'Selected time' })).toBeVisible();
    await expect(summary).toContainText('Oct 1 – 30, 2026');
    await expect(option).toHaveAttribute('aria-current', 'true');
    // Highlighted with the same green as a highly favorable day.
    const green = await page
      .locator('[data-status-tone="highly-favorable"]')
      .first()
      .evaluate((element) => {
        const probe = document.createElement('div');
        probe.style.background = 'var(--color-favorable-strong-surface)';
        element.append(probe);
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
      });
    await expect(option).toHaveCSS('background-color', green);

    // A longer range: the list and the edit card both follow it, and it survives Edit.
    await range.click();
    const rangeSheet = page.getByRole('dialog', { name: 'Search range' });
    await rangeSheet.getByRole('option', { name: 'Next 90 days' }).click();
    await expect(rangeSheet).toBeHidden();
    await expect(range).toHaveAccessibleName('Search range: Next 90 days');
    await expect(page).toHaveURL(/range=90/);
    await expect(summary).toContainText('Oct 1 – Dec 29, 2026');
    await expect(summary).toContainText('(Next 90 days)');

    // Edit returns to the search exactly as it was.
    await summary.getByRole('button', { name: 'Edit search' }).click();
    await expect(page).not.toHaveURL(/step=results/);
    await expect(page).toHaveURL(/date=2026-10-01/);
    await expect(page.getByRole('radio', { name: 'Business' })).toHaveAttribute('aria-checked', 'true');
    await expect(star).toHaveAccessibleName('Birth star (optional) Ashwini');
    await expect(picker).toContainText('Thursday, October 1');
    await expect(page).toHaveURL(/range=90/);
    await page.getByRole('button', { name: 'Find good times' }).click();
    await expect(summary).toContainText('(Next 90 days)');
    await expect(range).toHaveAccessibleName('Search range: Next 90 days');
  });

  test('the searched range keeps its start date; only the range changes its end', async ({ page }) => {
    await page.goto('/good-time?activity=business'); // today: Tue, Sep 29 (FIXED_NOW)
    await page.getByRole('button', { name: 'Find good times' }).click();
    const summary = page.getByRole('region', { name: 'Your search' });
    await expect(summary).toContainText('Sep 29 – Oct 28, 2026');

    const next = page.getByRole('region', { name: 'Next best days' });
    await next.getByRole('button', { name: /^View Thursday, October 1,/ }).click();
    await expect(page).toHaveURL(/date=2026-10-01/);
    await expect(summary).toContainText('Sep 29 – Oct 28, 2026');

    for (const [days, through] of [
      ['60', 'Sep 29 – Nov 27, 2026'],
      ['90', 'Sep 29 – Dec 27, 2026'],
    ] as const) {
      await next.getByRole('button', { name: /^Search range:/ }).click();
      await page
        .getByRole('dialog', { name: 'Search range' })
        .getByRole('option', { name: `Next ${days} days` })
        .click();
      await expect(summary).toContainText(through);
      await expect(summary).toContainText(`(Next ${days} days)`);
    }
    await expect(page).toHaveURL(/date=2026-10-01/);
  });

  test('Other: the description is committed by Find good times (no separate Find times button)', async ({
    page,
    apiRequests,
  }) => {
    await page.goto('/good-time');
    await page.getByRole('radio', { name: 'Other' }).click();
    const describe = page.getByLabel('Describe your activity');
    await expect(page.getByRole('button', { name: 'Find times' })).toHaveCount(0);
    const find = page.getByRole('button', { name: 'Find good times' });
    await expect(find).toBeDisabled();
    await describe.fill('Opening a bakery');
    await expect(page).not.toHaveURL(/text=/); // nothing is evaluated while typing
    expect(apiRequests.some((u) => u.searchParams.get('otherText') === 'Opening a bakery')).toBe(false);
    await expect(find).toBeEnabled();
    await find.click();
    await expect(page).toHaveURL(/step=results/);
    await expect(page).toHaveURL(/text=Opening\+a\+bakery/);
    await expect(page.getByRole('region', { name: 'Your search' })).toContainText('Opening a bakery');

    // Edit keeps the description; Enter in the field also searches.
    await page.getByRole('button', { name: 'Edit search' }).click();
    await expect(describe).toHaveValue('Opening a bakery');
    await describe.press('Enter');
    await expect(page).toHaveURL(/step=results/);
  });

  test('activity names fit their cards on common phone widths', async ({ page }) => {
    await page.goto('/good-time');
    await expect(page.getByRole('radio', { name: 'Housewarming' })).toBeVisible();
    for (const width of [320, 360, 375, 390, 412]) {
      await page.setViewportSize({ width, height: 844 });
      const problems = await page.getByRole('radiogroup').evaluate((group) =>
        [...group.querySelectorAll('button')].flatMap((button) => {
          const label = button.children[1] as HTMLElement;
          const text = label.textContent ?? '';
          const range = document.createRange();
          range.selectNodeContents(label);
          const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
          const box = button.getBoundingClientRect();
          const inside = [...range.getClientRects()].every((r) => r.left >= box.left && r.right <= box.right);
          const words = text.trim().split(/\s+/).length;
          return inside && lines <= words ? [] : [`${text}: inside=${inside} lines=${lines}`];
        }),
      );
      expect(problems, `at ${width}px`).toEqual([]);
    }
  });

  test('edit card: activity and birth star on one line each, the day count under the range', async ({
    page,
    apiRequests,
  }) => {
    await page.setViewportSize({ width: 375, height: 844 });
    await page.goto(
      '/good-time?activity=housewarming&nakshatra=Uttara+Bhadrapada&date=2026-10-01&step=results',
    );
    const summary = page.getByRole('region', { name: 'Your search' });
    await expect(summary).toContainText('Bhadrapada');
    const [activity, star, range] = await summary.locator('dl > div').all();
    const a = (await activity!.boundingBox())!;
    const b = (await star!.boundingBox())!;
    expect(a.x + a.width).toBeLessThanOrEqual(b.x); // side by side, no overlap
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    for (const dd of [activity!.locator('dd'), star!.locator('dd')]) {
      expect(await dd.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      const height = (await dd.boundingBox())!.height;
      expect(height).toBeLessThan(24); // a single line
    }
    const dates = (await range!.getByText('Oct 1 – 30, 2026').boundingBox())!;
    const count = (await range!.getByText('(Next 30 days)').boundingBox())!;
    expect(count.y).toBeGreaterThanOrEqual(dates.y + dates.height - 1); // its own line, below the dates
    expect(
      await range!.getByText('(Next 30 days)').evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeLessThan(
      await range!.getByText('Oct 1 – 30, 2026').evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    );
    const edit = (await summary.getByRole('button', { name: 'Edit search' }).boundingBox())!;
    expect(edit.y).toBeGreaterThanOrEqual(b.y + b.height - 1); // Edit sits beside the range, not the first row

    // Choosing a best time evaluates that day again and highlights the choice straight away.
    const next = page.getByRole('region', { name: 'Next best days' });
    const option = next.getByRole('button', { name: /^View Friday, October 2,/ });
    await option.click();
    await expect(option).toHaveAttribute('aria-current', 'true');
    await expect
      .poll(() =>
        apiRequests.some(
          (u) => u.pathname.endsWith('/muhurta/good-times') && u.searchParams.get('date') === '2026-10-02',
        ),
      )
      .toBe(true);
    await expect(page.getByRole('region', { name: /^(Best recommended time|Selected time)$/ })).toBeVisible();
  });

  test('a day with several recommended times lists them all; choosing one features it', async ({ page }) => {
    // The business fixture with a second Good Time (02:58 PM – 04:06 PM).
    const day = structuredClone(businessDay);
    const second = day.segments.find((segment) => segment.id === 's13')!;
    second.isGoodTime = true;
    second.status = day.segments.find((segment) => segment.id === 's2')!.status;
    day.goodTimes = ['s2', 's13'];
    await page.route('**/api/v1/muhurta/good-times?*', (route) => route.fulfill({ json: day }));

    await page.goto('/good-time?activity=business&date=2026-10-01&step=results');
    // Both of the day's times are listed by default; the day's best is highlighted.
    const best = page.getByRole('region', { name: 'Best recommended time' });
    await expect(best).toContainText('Recommended times');
    const first = best.getByRole('button', { name: /^08:53 AM – 10:22 AM/ });
    const other = best.getByRole('button', { name: /^02:58 PM – 04:06 PM/ });
    await expect(first).toHaveAttribute('aria-current', 'true');
    await expect(other).not.toHaveAttribute('aria-current', 'true');
    const green = await first.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(green).not.toBe('rgba(0, 0, 0, 0)');

    // Choosing the other time features it and moves the highlight.
    await other.click();
    await expect(page).toHaveURL(/at=2026-10-01T14%3A58/);
    const selected = page.getByRole('region', { name: 'Selected time' });
    await expect(selected).toContainText('02:58 PM – 04:06 PM');
    await expect(selected.getByRole('button', { name: /^02:58 PM – 04:06 PM/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(selected.getByRole('button', { name: /^02:58 PM – 04:06 PM/ })).toHaveCSS(
      'background-color',
      green,
    );
    await expect(selected.getByRole('button', { name: /^08:53 AM – 10:22 AM/ })).not.toHaveAttribute(
      'aria-current',
      'true',
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: test.info().outputPath('several-times.png') });
    await accessible(page);
  });

  test('Back from results opened by a link keeps the selection', async ({ page }) => {
    await page.goto('/good-time?activity=business&date=2026-10-01&step=results');
    await expect(page.getByRole('region', { name: 'Your search' })).toContainText('Business');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Find good times' })).toBeVisible();
    await expect(page).toHaveURL(/activity=business&date=2026-10-01$/);
  });
});

test('wide windows: Next best days has 30 / 60 / 90, highlights the shown day and keeps the chosen start', async ({
  page,
  apiRequests,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await withSavedLocation(page);
  await page.goto('/good-time?activity=business&date=2026-10-01');
  await expect(page.getByText('October 1 status')).toBeVisible();
  // The Panchang page's day banner, for the day shown.
  await expect(page.locator('[class*="pageBanner"]')).toContainText('Thursday, October 1');
  await expect(page.locator('[class*="pageBanner"]')).toContainText('Namaste, Asha Rao');
  const tile = page.getByRole('complementary', { name: 'Next best days' });
  const range = tile.getByRole('combobox', { name: 'Search range' });
  await expect(range).toHaveValue('30');
  await range.selectOption('60');
  await expect(page).toHaveURL(/range=60/);
  await expect
    .poll(() =>
      apiRequests.some(
        (u) =>
          u.pathname.endsWith('/muhurta/day-summaries') &&
          u.searchParams.get('start') === '2026-10-01' &&
          u.searchParams.get('days') === '60',
      ),
    )
    .toBe(true);
  await expect(tile.locator('li[aria-current="date"]')).toContainText('Thursday, October 1');

  // A best day becomes the shown day (highlighted); the range still starts on the chosen date.
  await tile.getByRole('button', { name: 'View Friday, October 2' }).click();
  await expect(page).toHaveURL(/date=2026-10-02/);
  await expect(page).toHaveURL(/from=2026-10-01/);
  await expect(tile.locator('li[aria-current="date"]')).toContainText('Friday, October 2');
  await expect(tile).toContainText('Thursday, October 1 –');
  await expect(range).toHaveValue('60');

  // The date controls still show the chosen date (Oct 1); moving it starts a new range there.
  await expect(page.getByRole('group', { name: 'Date' })).toContainText('Thursday, October 1');
  await page.getByRole('group', { name: 'Date' }).getByRole('button', { name: 'Next day' }).click();
  await expect(page).toHaveURL(/date=2026-10-02/);
  await expect(page).not.toHaveURL(/from=/);
});

test('wide windows keep the desktop Find a Good Time page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await withSavedLocation(page);
  await page.goto('/good-time?activity=business&date=2026-10-01&step=results');
  await expect(page.getByRole('heading', { level: 1, name: 'Find a Good Time' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Day' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Next best days' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find good times' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Your search' })).toHaveCount(0);
});
