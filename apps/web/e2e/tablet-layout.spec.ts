import { expect, test, withSavedLocation } from './fixtures';

// Tablets in portrait (e.g. Surface Pro 10, 960 CSS px) use the phone layout: the fixed header and bottom bar must
// span the whole width, so page content never shows beside them, and nothing scrolls sideways.
test('tablet portrait: full-width fixed header and bottom bar on every page', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 960, height: 1440 });
  await withSavedLocation(page);
  for (const path of ['/calendar', '/good-time', '/festivals', '/settings', '/profile', '/about']) {
    await page.goto(path);
    const header = page.getByRole('banner');
    await expect(header).toBeVisible();
    await expect.poll(async () => (await header.boundingBox())?.width).toBe(960);
    expect((await header.boundingBox())!.x).toBe(0);
    const bar = page
      .getByRole('navigation', { name: 'App navigation' })
      .or(page.getByRole('list', { name: 'What you can do' }));
    await expect(bar).toBeVisible();
    const heading = (await page.locator('main h1:visible, main h2:visible').first().boundingBox())!;
    expect(heading.y).toBeGreaterThanOrEqual((await header.boundingBox())!.height - 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
