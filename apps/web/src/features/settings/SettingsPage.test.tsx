import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { apiRequests, TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute } from '../../test/render';

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
const initial = {
  defaultTradition: 'telugu',
  defaultLocationId: location.locationId,
  defaultLocation: location,
  revision: 2,
  chartStyle: 'south-indian',
  ayanamsa: 'lahiri',
};
const secondLocation = {
  ...location,
  locationId: 'e96544af-55b1-458b-92e0-33044c47ad28',
  city: 'Liberty Hill',
  latitude: 30.6649,
  longitude: -97.9225,
};
function backend() {
  let settings: Omit<typeof initial, 'defaultLocation' | 'defaultLocationId'> & {
    defaultLocation: typeof location | null;
    defaultLocationId: string | null;
  } = { ...initial };
  let locations = [location, secondLocation];
  const saves: unknown[] = [];
  server.use(
    http.get(`${TEST_API_BASE_URL}/api/v1/settings`, () => HttpResponse.json(settings)),
    http.get(`${TEST_API_BASE_URL}/api/v1/settings/locations`, () => HttpResponse.json(locations)),
    http.put(`${TEST_API_BASE_URL}/api/v1/settings`, async ({ request }) => {
      const values = (await request.json()) as typeof initial;
      saves.push(values);
      settings = {
        ...settings,
        ...values,
        defaultLocation: locations.find((item) => item.locationId === values.defaultLocationId) ?? null,
        revision: settings.revision + 1,
      };
      return HttpResponse.json(settings);
    }),
    http.delete(`${TEST_API_BASE_URL}/api/v1/settings/locations/:id`, ({ params }) => {
      locations = locations.filter((item) => item.locationId !== params.id);
      return HttpResponse.json({ ...settings, defaultLocationId: null, defaultLocation: null, revision: 3 });
    }),
  );
  return { saves };
}
const auth = () => createInMemoryAuthClient({ user: { id: 'u1' } });
describe('Settings', () => {
  it("applies both saved defaults to the header and subsequent today's Panchang requests", async () => {
    backend();
    const { router } = renderRoute('/settings', { auth: auth() });
    await waitFor(() => expect(screen.getByLabelText('Default Tradition')).toHaveValue('telugu'));
    const header = within(screen.getByRole('banner'));
    await waitFor(() => expect(header.getByRole('combobox', { name: 'Tradition' })).toHaveValue('telugu'));
    await userEvent.selectOptions(screen.getByLabelText('Default Tradition'), 'tamil');
    await userEvent.selectOptions(screen.getByLabelText('Default Location'), secondLocation.locationId);
    expect(header.getByRole('combobox', { name: 'Tradition' })).toHaveValue('telugu');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Your settings have been saved.');
    expect(header.getByRole('combobox', { name: 'Tradition' })).toHaveValue('tamil');
    expect(header.getByText('Liberty Hill, Texas, United States')).toBeInTheDocument();
    await act(() => router.navigate('/festivals'));
    await waitFor(() =>
      expect(
        apiRequests.some(
          (url) =>
            url.pathname.endsWith('/panchang/today') &&
            url.searchParams.get('tradition') === 'tamil' &&
            url.searchParams.get('latitude') === '30.66' &&
            url.searchParams.get('longitude') === '-97.92',
        ),
      ).toBe(true),
    );
  });
  it('loads existing defaults and saves only when Save is explicitly clicked', async () => {
    const { saves } = backend();
    renderRoute('/settings', { auth: auth() });
    const tradition = await screen.findByRole('combobox', { name: 'Default Tradition' });
    await waitFor(() => expect(tradition).toHaveValue('telugu'));
    expect(screen.getByRole('combobox', { name: 'Default Location' })).toHaveValue(location.locationId);
    await userEvent.selectOptions(tradition, 'tamil');
    expect(saves).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Your settings have been saved.')).toBeInTheDocument();
    expect(saves).toEqual([
      {
        defaultTradition: 'tamil',
        defaultLocationId: location.locationId,
        revision: 2,
        chartStyle: 'south-indian',
        ayanamsa: 'lahiri',
      },
    ]);
  });
  it('deletes a default location and immediately clears the default and list', async () => {
    backend();
    renderRoute('/settings', { auth: auth() });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Austin, Texas, United States' }));
    expect(
      await screen.findByRole('button', { name: 'Delete Liberty Hill, Texas, United States' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete Austin, Texas, United States' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Default Location' })).toHaveValue('');
  });
  it('puts Profile before Settings and Log out and navigates to Settings', async () => {
    backend();
    const { router } = renderRoute('/about', { auth: auth() });
    await userEvent.click(await screen.findByRole('button', { name: 'Open account menu' }));
    const profile = screen.getByRole('link', { name: 'Profile' });
    const options = profile.closest('ul');
    expect(options).not.toBeNull();
    expect(
      within(options as HTMLUListElement)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
      // AC1 (#28): Vedic Profiles sits between Profile and Settings, desktop and mobile.
    ).toEqual(['Profile', 'Vedic Profiles', 'Settings', 'Log out']);
    await userEvent.click(screen.getByRole('link', { name: 'Settings' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));
    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
  });
  it('applies defaults to calculations after login without saving settings', async () => {
    const { saves } = backend();
    const { services } = renderRoute('/calendar', { auth: auth() });
    await waitFor(() =>
      expect(services.queryClient.getQueryData(['auth', 'settings', 'u1'])).toMatchObject(initial),
    );
    expect(saves).toHaveLength(0);
    expect(
      await screen.findByText(/Austin, Texas, United States/, { selector: 'button span' }),
    ).toBeInTheDocument();
  });
  it('shows the persisted Chart Style and Ayanamsa after Default Location and before Save', async () => {
    backend();
    renderRoute('/settings', { auth: auth() });
    const chartStyle = await screen.findByRole('combobox', { name: 'Chart Style' });
    const ayanamsa = screen.getByRole('combobox', { name: 'Ayanamsa' });
    expect(chartStyle).toHaveValue('south-indian');
    expect(ayanamsa).toHaveValue('lahiri');
    expect(
      within(chartStyle)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['North Indian', 'South Indian', 'East Indian']);
    expect(
      within(ayanamsa)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['N.C. Lahiri', 'Raman', 'Krishnamurti (KP)', 'True Chitra']);
    const fields = screen.getByRole('group', { name: 'Settings defaults' });
    const order = within(fields)
      .getAllByRole('combobox')
      .map((select) => select.id);
    expect(order).toEqual(['default-tradition', 'default-location', 'chart-style', 'ayanamsa']);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(fields.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it.each([
    ['north-indian', 'lahiri'],
    ['north-indian', 'raman'],
    ['north-indian', 'krishnamurti'],
    ['north-indian', 'true-chitra'],
    ['south-indian', 'lahiri'],
    ['south-indian', 'raman'],
    ['south-indian', 'krishnamurti'],
    ['south-indian', 'true-chitra'],
    ['east-indian', 'lahiri'],
    ['east-indian', 'raman'],
    ['east-indian', 'krishnamurti'],
    ['east-indian', 'true-chitra'],
  ])('loads, edits and saves chart style %s with ayanamsa %s', async (chartStyle, ayanamsa) => {
    const { saves } = backend();
    renderRoute('/settings', { auth: auth() });
    const chartSelect = await screen.findByRole('combobox', { name: 'Chart Style' });
    const ayanamsaSelect = screen.getByRole('combobox', { name: 'Ayanamsa' });
    await waitFor(() => expect(chartSelect).toHaveValue('south-indian'));
    await userEvent.selectOptions(chartSelect, chartStyle);
    await userEvent.selectOptions(ayanamsaSelect, ayanamsa);
    expect(saves).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Your settings have been saved.')).toBeInTheDocument();
    expect(saves).toEqual([
      {
        defaultTradition: 'telugu',
        defaultLocationId: location.locationId,
        revision: 2,
        chartStyle,
        ayanamsa,
      },
    ]);
    expect(chartSelect).toHaveValue(chartStyle);
    expect(ayanamsaSelect).toHaveValue(ayanamsa);
  });
  it('saves unchanged values and preserves tradition and location selections', async () => {
    const { saves } = backend();
    renderRoute('/settings', { auth: auth() });
    const tradition = await screen.findByRole('combobox', { name: 'Default Tradition' });
    await waitFor(() => expect(tradition).toHaveValue('telugu'));
    await userEvent.selectOptions(tradition, 'tamil');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Default Location' }),
      secondLocation.locationId,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Your settings have been saved.');
    expect(saves).toEqual([
      {
        defaultTradition: 'tamil',
        defaultLocationId: secondLocation.locationId,
        revision: 2,
        chartStyle: 'south-indian',
        ayanamsa: 'lahiri',
      },
    ]);
    expect(screen.getByRole('combobox', { name: 'Chart Style' })).toHaveValue('south-indian');
  });
  it('surfaces an error and shows no success when the API rejects the save', async () => {
    backend();
    let attempts = 0;
    server.use(
      http.put(`${TEST_API_BASE_URL}/api/v1/settings`, () => {
        attempts += 1;
        return HttpResponse.json(
          {
            title: 'Validation failed',
            status: 400,
            errors: { ayanamsa: ['Choose a supported ayanamsa.'] },
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );
    renderRoute('/settings', { auth: auth() });
    const ayanamsa = await screen.findByRole('combobox', { name: 'Ayanamsa' });
    await waitFor(() => expect(ayanamsa).toHaveValue('lahiri'));
    await userEvent.selectOptions(ayanamsa, 'raman');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        'Settings could not be saved. Reload settings if another session changed them.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Your settings have been saved.')).not.toBeInTheDocument();
    expect(attempts).toBe(1);
  });
  it('rejects an unsupported server value instead of silently showing a default', async () => {
    backend();
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/v1/settings`, () =>
        HttpResponse.json({ ...initial, chartStyle: 'west-indian' }),
      ),
    );
    renderRoute('/settings', { auth: auth() });
    expect(await screen.findByText('Settings could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Chart Style' })).not.toBeInTheDocument();
  });
  it('allows a temporary tradition choice without modifying saved defaults', async () => {
    const { saves } = backend();
    const { router } = renderRoute('/settings', { auth: auth() });
    await screen.findByText(/deleting it restores the fallback/);
    await act(() => router.navigate('/calendar'));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Tradition' }), 'tamil');
    expect(saves).toHaveLength(0);
    await act(() => router.navigate('/settings'));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Default Tradition' })).toHaveValue('telugu'),
    );
  });
});
