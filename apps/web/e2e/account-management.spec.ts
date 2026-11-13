import AxeBuilder from '@axe-core/playwright';

import { expect, test } from './fixtures';

const location = {
  locationId: 'f85dddfa-2fb8-48c1-a3bf-36310c47f609',
  city: 'Austin',
  state: 'Texas',
  country: 'United States',
  countryCode: 'US',
  postalCode: '78701',
  latitude: 30.2672,
  longitude: -97.7431,
  timeZone: 'America/Chicago',
};
const profile = {
  id: 'u1',
  firstName: 'Raju',
  lastName: 'Bhupathi',
  displayName: 'Raju B',
  streetAddress: '1 Main Street',
  streetAddress2: null,
  country: 'US',
  state: 'Texas',
  city: 'Austin',
  postalCode: '78701',
  email: 'aprraju@gmail.com',
  phoneNumber: null,
  revision: 0,
  nameSyncPending: false,
};

test('profile fits narrow phones with readable fields and reachable Save', async ({ page }) => {
  await page.route('**/api/v1/auth/profile', (route) =>
    route.fulfill({ json: { ...profile, nameSyncPending: true } }),
  );
  await page.goto('/profile');
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Raju');
  await expect(page.getByRole('button', { name: 'Retry name synchronization' })).toHaveCount(0);
  for (const width of [320, 375, 640]) {
    await page.setViewportSize({ width, height: 812 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    const first = await page.getByLabel('First Name', { exact: true }).boundingBox();
    const last = await page.getByLabel('Last Name', { exact: true }).boundingBox();
    expect(last!.y).toBeGreaterThan(first!.y + first!.height);
    expect(first!.width).toBeGreaterThan(width * 0.6);
    const save = page.getByRole('button', { name: 'Save', exact: true });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
  }
});

test('profile fields load, save without a page reload, and meet accessibility requirements', async ({
  page,
}) => {
  let current = { ...profile };
  await page.route('**/api/v1/auth/profile', async (route) => {
    if (route.request().method() === 'PATCH') {
      const request = route.request().postDataJSON() as { changes: Partial<typeof profile> };
      current = { ...current, ...request.changes, revision: current.revision + 1 };
    }
    await route.fulfill({ json: current });
  });
  await page.goto('/profile');
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Raju');
  await expect(page.getByLabel('Display Name', { exact: true })).toHaveValue('Raju B');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('aprraju@gmail.com');
  await page.getByLabel('Street Address 2', { exact: true }).fill('Apartment 2');
  await page.getByLabel('Display Name', { exact: true }).fill('Raju Bhupathi');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Your profile has been saved.')).toBeVisible();
  // Wide windows: the header's account menu. Phones: the header's account button opens the "Your Account" sheet.
  const phone = page.viewportSize()!.width < 1024;
  if (phone) {
    await page.getByRole('banner').getByRole('button', { name: 'Your account' }).click();
    const sheet = page.getByRole('dialog', { name: 'Your Account' });
    await expect(sheet).toContainText('Raju Bhupathi');
    await expect(sheet.getByRole('link', { name: /^Profile/ })).toHaveAttribute('href', '/profile');
    await expect(sheet.getByRole('link', { name: /^Settings/ })).toHaveAttribute('href', '/settings');
    await expect(sheet.getByRole('button', { name: 'Log out' })).toBeVisible();
  } else {
    const menu = page.getByRole('banner');
    await menu.getByRole('button', { name: 'Open account menu' }).click();
    await expect(menu.getByText('Raju Bhupathi', { exact: true })).toBeVisible();
  }
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((item) => item.id)).toEqual([]);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test('settings prefill, explicit save, and default deletion work under production CSP', async ({ page }) => {
  let saved = [location];
  let settings: {
    defaultTradition: string | null;
    defaultLocationId: string | null;
    defaultLocation: typeof location | null;
    revision: number;
    chartStyle: string;
    ayanamsa: string;
  } = {
    defaultTradition: 'telugu',
    defaultLocationId: location.locationId,
    defaultLocation: location,
    revision: 1,
    chartStyle: 'south-indian',
    ayanamsa: 'lahiri',
  };
  await page.route('**/api/v1/settings', async (route) => {
    if (route.request().method() === 'PUT') {
      const request = route.request().postDataJSON() as { defaultTradition: string };
      settings = { ...settings, ...request, revision: settings.revision + 1 };
    }
    await route.fulfill({ json: settings });
  });
  await page.route('**/api/v1/settings/locations', (route) => route.fulfill({ json: saved }));
  await page.route('**/api/v1/settings/locations/*', async (route) => {
    saved = [];
    settings = {
      ...settings,
      defaultLocation: null,
      defaultLocationId: null,
      revision: settings.revision + 1,
    };
    await route.fulfill({ json: settings });
  });
  await page.goto('/settings');
  await expect(page.getByLabel('Default Tradition')).toHaveValue('telugu');
  await expect(page.getByLabel('Default Location')).toHaveValue(location.locationId);
  await expect(page.getByLabel('Chart Style')).toHaveValue('south-indian');
  await expect(page.getByLabel('Ayanamsa')).toHaveValue('lahiri');
  for (const width of [320, 375, 640]) {
    await page.setViewportSize({ width, height: 812 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    const tradition = await page.getByLabel('Default Tradition').boundingBox();
    const selectedLocation = await page.getByLabel('Default Location').boundingBox();
    expect(selectedLocation!.y).toBeGreaterThan(tradition!.y + tradition!.height);
    const remove = page.getByRole('button', { name: 'Delete Austin, Texas, United States' });
    await remove.scrollIntoViewIfNeeded();
    await expect(remove).toBeInViewport();
  }
  await page.getByLabel('Default Tradition').selectOption('tamil');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Your settings have been saved.')).toBeVisible();
  await expect(page.getByRole('banner').getByRole('combobox', { name: 'Tradition' })).toHaveValue('tamil');
  await expect(
    page.getByRole('banner').getByText('Austin, Texas, United States', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Delete Austin, Texas, United States' }).click();
  await expect(page.getByLabel('Default Location')).toHaveValue('');
  await expect(page.getByText(/No saved locations yet/)).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((item) => item.id)).toEqual([]);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
