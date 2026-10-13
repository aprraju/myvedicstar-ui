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
  it('applies both saved defaults to the header and subsequent Today calculations', async () => {
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
    await act(() => router.navigate('/dashboard'));
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
      { defaultTradition: 'tamil', defaultLocationId: location.locationId, revision: 2 },
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
    ).toEqual(['Profile', 'Settings', 'Log out']);
    await userEvent.click(screen.getByRole('link', { name: 'Settings' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));
    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
  });
  it('applies defaults to calculations after login without saving settings', async () => {
    const { saves } = backend();
    const { services } = renderRoute('/dashboard', { auth: auth() });
    await waitFor(() =>
      expect(services.queryClient.getQueryData(['auth', 'settings', 'u1'])).toMatchObject(initial),
    );
    expect(saves).toHaveLength(0);
    expect(
      await screen.findByText(/Austin, Texas, United States/, { selector: 'button span' }),
    ).toBeInTheDocument();
  });
  it('allows a temporary tradition choice without modifying saved defaults', async () => {
    const { saves } = backend();
    const { router } = renderRoute('/settings', { auth: auth() });
    await screen.findByText(/deleting it restores the fallback/);
    await act(() => router.navigate('/dashboard'));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Tradition' }), 'tamil');
    expect(saves).toHaveLength(0);
    await act(() => router.navigate('/settings'));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Default Tradition' })).toHaveValue('telugu'),
    );
  });
});
