import { expect, test, withSavedLocation } from './fixtures';

for (const width of [344, 768, 884]) {
  test(`GeoNames chooser works without overflow at ${width}px`, async ({ page }) => {
    await withSavedLocation(page);
    await page.setViewportSize({ width, height: 800 });
    await page.route('**/config.json', async (route) => {
      const response = await route.fetch();
      const config = (await response.json()) as Record<string, unknown>;
      await route.fulfill({
        response,
        json: { ...config, environment: 'test', auth: { mode: 'mock' }, locationSearch: { enabled: true } },
      });
    });
    await page.route('**/locations/search?**', (route) =>
      route.fulfill({
        json: {
          results: [
            {
              id: '4671654',
              city: 'Austin',
              region: 'Texas',
              country: 'United States',
              countryCode: 'US',
              postalCode: null,
              latitude: 30.267212,
              longitude: -97.743112,
              source: 'city',
            },
          ],
        },
      }),
    );
    await page.route('**/locations/timezone?**', (route) =>
      route.fulfill({ json: { timeZone: 'America/Chicago' } }),
    );
    let saved: Record<string, unknown> | undefined;
    await page.route('**/api/v1/settings/locations', async (route) => {
      if (route.request().method() !== 'POST') return route.fulfill({ json: [] });
      expect(route.request().headers().authorization).toMatch(/^Bearer /);
      saved = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ json: { ...saved, locationId: 'e96544af-55b1-458b-92e0-33044c47ad28' } });
    });
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Change location: Austin, Texas' }).click();
    const dialog = page.getByRole('dialog', { name: 'Choose your location' });
    await dialog.getByRole('combobox', { name: 'City, ZIP code or coordinates' }).fill('Austin');
    await page.clock.runFor(400);
    const suggestion = dialog.getByRole('option', { name: 'Austin, Texas, United States' });
    await expect(suggestion).toBeVisible();
    expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(
      0,
    );
    await suggestion.click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(() => saved)
      .toMatchObject({
        latitude: 30.267212,
        longitude: -97.743112,
        timeZone: 'America/Chicago',
      });
  });
}
