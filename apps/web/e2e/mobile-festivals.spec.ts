import AxeBuilder from '@axe-core/playwright';

import { expect, test, withSavedLocation } from './fixtures';

test.describe('Upcoming festivals on phones', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withSavedLocation(page);
  });

  test('next 30 days by month; cards expand to the engine’s own timing; filter, range and tradition refresh', async ({
    page,
    apiRequests,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/festivals');
    await expect(page.getByRole('heading', { level: 1, name: 'Festivals & Observances' })).toBeVisible();
    await expect(page.getByText('Austin, Texas • Telugu tradition')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next 30 days' })).toBeVisible();
    await expect
      .poll(() =>
        apiRequests.some(
          (u) => u.pathname.endsWith('/festivals/upcoming') && u.searchParams.get('days') === '30',
        ),
      )
      .toBe(true);

    const next = page.getByRole('region', { name: 'Coming up next' });
    await expect(next).toContainText('Ekadashi');
    await expect(next).toContainText('Observance • In 5 days');
    // Coming up next expands like the cards.
    await next.getByRole('button', { name: 'View observance details' }).click();
    await expect(next.getByText('Observed at Sunrise')).toBeVisible();
    await expect(next.getByText('Tithi transition')).toBeVisible();
    await next.getByRole('button', { name: 'Hide details' }).click();
    await expect(next.getByText('Observed at Sunrise')).toBeHidden();

    // Separate month headings, not one continuous list.
    const october = page.getByRole('region', { name: 'October 2026' });
    const november = page.getByRole('region', { name: 'November 2026' });
    await expect(october).toContainText('Mahalaya Amavasya');
    await expect(november).toContainText('Deepavali (Lakshmi Puja)');
    await expect(october).not.toContainText('Deepavali');

    // Collapsed: name, date, category and a one-line description; details reveal the exact timing type.
    const mahalaya = october.getByRole('listitem').filter({ hasText: 'Mahalaya Amavasya' });
    await expect(mahalaya).toContainText('Festival');
    const description = mahalaya.getByText('The new moon ending Pitru Paksha', { exact: false });
    await expect(description).toHaveCSS('white-space', 'nowrap');
    const details = mahalaya.getByRole('button', { name: 'View observance details' });
    await expect(details).toHaveAttribute('aria-expanded', 'false');
    await expect(mahalaya.getByText('Observed at Aparahna')).toBeHidden();
    await details.click();
    await expect(mahalaya.getByRole('button', { name: 'Hide details' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(mahalaya.getByText('Observed at Aparahna')).toBeVisible();
    await expect(mahalaya).toContainText('Oct 9, 02:27 PM – Oct 9, 04:47 PM');
    await expect(mahalaya.getByText('Tithi transition')).toBeVisible();
    await expect(mahalaya).toContainText('Tithi: Oct 9, 11:06 AM – Oct 10, 10:49 AM');
    await expect(description).toHaveCSS('white-space', 'normal'); // full description when open

    const sankranti = october.getByRole('listitem').filter({ hasText: 'Sankranti' });
    await sankranti.getByRole('button', { name: 'View observance details' }).click();
    await expect(sankranti.getByText('Observed at Sunset')).toBeVisible();
    await expect(sankranti.getByText('Sankranti transition')).toBeVisible();
    await expect(sankranti).toContainText('Sankranti: Oct 17,');
    await expect(page.locator('main')).not.toContainText('Astronomical'); // no generic labels
    await page.screenshot({ path: test.info().outputPath('festivals.png'), fullPage: true });

    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(accessibility.violations.map((item) => item.id)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Filter: the page stays where it is.
    await page.evaluate(() => window.scrollTo(0, 200));
    // dispatchEvent: Playwright's click would itself scroll the button out from under the fixed header.
    await page.getByRole('button', { name: 'Festivals', exact: true }).dispatchEvent('click');
    await expect(page).toHaveURL(/show=festival/);
    expect(await page.evaluate(() => window.scrollY)).toBe(200);
    await expect(page.locator('main [data-category="observance"]')).toHaveCount(0);

    // Range: a bottom sheet; the request covers the new range.
    await page.getByRole('button', { name: 'Next 30 days' }).click();
    await page
      .getByRole('dialog', { name: 'Show the next' })
      .getByRole('option', { name: '90 days' })
      .click();
    await expect(page).toHaveURL(/days=90/);
    await expect
      .poll(() =>
        apiRequests.some(
          (u) => u.pathname.endsWith('/festivals/upcoming') && u.searchParams.get('days') === '90',
        ),
      )
      .toBe(true);

    // Another tradition refreshes the events.
    await page.getByRole('combobox', { name: 'Tradition' }).selectOption('tamil');
    await expect
      .poll(() =>
        apiRequests.some(
          (u) => u.pathname.endsWith('/festivals/upcoming') && u.searchParams.get('tradition') === 'tamil',
        ),
      )
      .toBe(true);
  });
});

test('wide windows show the event cards three per row (fewer as the content narrows), with the same details', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await withSavedLocation(page);
  await page.goto('/festivals');
  await expect(page.getByRole('heading', { level: 1, name: 'Festivals & Observances' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Show the next' })).toBeVisible(); // desktop controls unchanged
  // The Panchang page's day banner, for today.
  await expect(page.getByText('Namaste, Asha Rao')).toBeVisible();
  await expect(page.locator('[class*="pageBanner"]')).toContainText('Tuesday, September 29');
  await expect(page.getByRole('region', { name: 'Coming up next' })).toHaveCount(0);
  const cards = page.getByRole('region', { name: 'October 2026' }).getByRole('listitem');
  const boxes = await Promise.all([0, 1, 2, 3].map(async (i) => (await cards.nth(i).boundingBox())!));
  expect(new Set(boxes.slice(0, 3).map((box) => Math.round(box.y))).size).toBe(1); // three in the first row
  expect(boxes[3]!.y).toBeGreaterThan(boxes[0]!.y); // the fourth starts the next row
  // Details are expanded by default on wide windows: every card shows its observance and transition.
  await expect(page.getByRole('button', { name: 'View observance details' })).toHaveCount(0);
  const mahalaya = cards.filter({ hasText: 'Mahalaya Amavasya' });
  await expect(mahalaya.getByText('Observed at Aparahna')).toBeVisible();
  await expect(mahalaya.getByText('Tithi transition')).toBeVisible();
  await mahalaya.getByRole('button', { name: 'Hide details' }).click();
  await expect(mahalaya.getByText('Observed at Aparahna')).toBeHidden();
});
