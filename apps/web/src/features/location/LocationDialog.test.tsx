import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { austin, hyderabad, storeSelectedLocation } from '../../test/location-fixtures';
import { apiRequests, scenarios, TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { fakeGeolocation, renderRoute as renderTestRoute } from '../../test/render';

const renderRoute = (path: string, options: Parameters<typeof renderTestRoute>[1] = {}) =>
  renderTestRoute(path === '/' ? '/calendar' : path, {
    auth: createInMemoryAuthClient({ user: { id: 'location-user' } }),
    ...options,
  });

const openDialog = async () => {
  const banner = await screen.findByRole('banner');
  await userEvent.click(await within(banner).findByRole('button', { name: /location/i }));
  return screen.findByRole('dialog', { name: 'Choose your location' });
};

const searchFor = async (dialog: HTMLElement, text: string) => {
  const input = within(dialog).getByRole('searchbox', { name: 'City, ZIP code or coordinates' });
  await userEvent.clear(input);
  await userEvent.type(input, text);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
};

describe('location selection', () => {
  it('finds a city, confirms it and updates the Panchang', async () => {
    renderRoute('/');
    const dialog = await openDialog();
    expect(await axeViolations(dialog)).toEqual([]);

    await searchFor(dialog, 'Austin, TX');
    expect(await within(dialog).findByText('Austin, Texas, United States')).toBeInTheDocument();
    expect(within(dialog).getByText('Time zone: America/Chicago')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use this location' }));

    expect(await screen.findByRole('button', { name: 'Change location: Austin, Texas' })).toBeInTheDocument();
    expect(await screen.findByText('All times shown in local time — Austin, Texas')).toBeInTheDocument();
    expect(apiRequests.some((u) => u.searchParams.get('place') === 'Austin, TX')).toBe(true);
  });

  it('explains that ZIP codes are not searchable yet', async () => {
    renderRoute('/');
    const dialog = await openDialog();
    await searchFor(dialog, '78701');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'ZIP or postal code isn’t available yet',
    );
    expect(apiRequests.filter((u) => u.pathname.endsWith('/resolve'))).toHaveLength(0);
  });

  it('reports places the backend cannot find', async () => {
    renderRoute('/');
    const dialog = await openDialog();
    await searchFor(dialog, 'Nowhereville, ZZ');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('We couldn’t find that place');
  });

  it('validates coordinates typed into the search box', async () => {
    renderRoute('/');
    const dialog = await openDialog();
    await searchFor(dialog, '95, 10');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Latitude must be between -90 and 90.',
    );
  });

  it('accepts latitude and longitude in the coordinates form', async () => {
    renderRoute('/');
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByText('Enter latitude and longitude'));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Latitude' }), '200');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Longitude' }), 'abc');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use these coordinates' }));
    expect(await within(dialog).findByText('Latitude must be between -90 and 90.')).toBeInTheDocument();
    expect(within(dialog).getByText('Longitude must be a number.')).toBeInTheDocument();

    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Latitude' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Latitude' }), '17.385');
    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Longitude' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Longitude' }), '78.4867');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use these coordinates' }));
    expect(
      await screen.findByRole('button', { name: 'Change location: Hyderabad, Telangana' }),
    ).toBeInTheDocument();
  });

  it('uses the current location when the user asks', async () => {
    const geolocation = fakeGeolocation({
      permission: 'prompt',
      position: { latitude: 17.385, longitude: 78.4867 },
    });
    window.localStorage.setItem('mvs.location.permissionDenied', 'true'); // no automatic request in this test
    renderRoute('/', { geolocation });
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use my current location' }));
    expect(
      await screen.findByRole('button', { name: 'Change location: Hyderabad, Telangana' }),
    ).toBeInTheDocument();
    expect(geolocation.requests).toBe(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explains a denied permission and remembers it', async () => {
    renderRoute('/', { geolocation: fakeGeolocation({ permission: 'prompt', error: 'permissionDenied' }) });
    await waitFor(() => expect(window.localStorage.getItem('mvs.location.permissionDenied')).toBe('true'));
    const dialog = await openDialog();
    expect(within(dialog).getByText(/Location access is turned off/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Use my current location' })).toBeInTheDocument();
  });

  it('never asks again automatically after a denial', async () => {
    window.localStorage.setItem('mvs.location.permissionDenied', 'true');
    const geolocation = fakeGeolocation({
      permission: 'prompt',
      position: { latitude: 30.27, longitude: -97.74 },
    });
    renderRoute('/', { geolocation });
    expect(await screen.findByText('Choose a location to see today’s Panchang')).toBeInTheDocument();
    expect(geolocation.requests).toBe(0);
  });

  it('detects the location on first visit when permission allows', async () => {
    const geolocation = fakeGeolocation({
      permission: 'granted',
      position: { latitude: 30.2672, longitude: -97.7431 },
    });
    renderRoute('/', { geolocation });
    expect(await screen.findByText('All times shown in local time — Austin, Texas')).toBeInTheDocument();
    expect(geolocation.requests).toBe(1);
  });

  it('keeps a returning visitor’s location without asking', async () => {
    storeSelectedLocation(hyderabad);
    const geolocation = fakeGeolocation({
      permission: 'granted',
      position: { latitude: 30.27, longitude: -97.74 },
    });
    renderRoute('/', { geolocation });
    expect(
      await screen.findByRole('button', { name: 'Change location: Hyderabad, Telangana' }),
    ).toBeInTheDocument();
    expect(geolocation.requests).toBe(0);
  });

  it('lists recent locations and lets the user remove one', async () => {
    let locations = [austin, hyderabad].map((item, index) => ({
      locationId: index ? 'e96544af-55b1-458b-92e0-33044c47ad28' : 'f85dddfa-2fb8-48c1-a3bf-36310c47f609',
      city: index ? 'Hyderabad' : 'Austin',
      state: index ? 'Telangana' : 'Texas',
      country: null,
      countryCode: index ? 'IN' : 'US',
      postalCode: null,
      latitude: item.latitude,
      longitude: item.longitude,
      timeZone: item.timeZone,
    }));
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/v1/settings/locations`, () => HttpResponse.json(locations)),
      http.delete(`${TEST_API_BASE_URL}/api/v1/settings/locations/:id`, ({ params }) => {
        locations = locations.filter((item) => item.locationId !== params.id);
        return HttpResponse.json({
          defaultTradition: null,
          defaultLocationId: null,
          defaultLocation: null,
          revision: 1,
          chartStyle: 'south-indian',
          ayanamsa: 'lahiri',
        });
      }),
    );
    storeSelectedLocation(austin);
    renderRoute('/');
    const dialog = await openDialog();
    const recent = await within(dialog).findByRole('region', { name: 'Recent locations' });
    await userEvent.click(within(recent).getByRole('button', { name: 'Hyderabad, Telangana' }));
    expect(
      await screen.findByRole('button', { name: 'Change location: Hyderabad, Telangana' }),
    ).toBeInTheDocument();

    const reopened = await openDialog();
    await userEvent.click(
      within(reopened).getByRole('button', { name: 'Remove Austin, Texas from recent locations' }),
    );
    await waitFor(() => expect(locations).toHaveLength(1));
  });

  it('ignores tampered stored locations', async () => {
    window.localStorage.setItem(
      'mvs.location.selected',
      JSON.stringify({ label: '<img onerror=x>', latitude: 999 }),
    );
    renderRoute('/');
    expect(await screen.findByText('Choose a location to see today’s Panchang')).toBeInTheDocument();
  });

  it('shows a friendly error when resolving the current position fails', async () => {
    server.use(scenarios.serverError('/locations/resolve'));
    renderRoute('/', {
      geolocation: fakeGeolocation({ permission: 'granted', position: { latitude: 1, longitude: 1 } }),
    });
    const dialog = await openDialog();
    expect(
      await within(dialog).findByText("We couldn't load this right now. Please try again in a moment."),
    ).toBeInTheDocument();
  });
});

describe('signed-in saved locations', () => {
  const saved = (
    id: string,
    place: typeof austin,
    coordinates?: { latitude: number; longitude: number },
  ) => ({
    locationId: id,
    city: place.city ?? null,
    state: place.region ?? null,
    country: place.country ?? null,
    countryCode: place.countryCode ?? null,
    postalCode: null,
    latitude: coordinates?.latitude ?? place.latitude,
    longitude: coordinates?.longitude ?? place.longitude,
    timeZone: place.timeZone,
  });
  const HYDERABAD_ID = 'e96544af-55b1-458b-92e0-33044c47ad28';
  const AUSTIN_ID = 'f85dddfa-2fb8-48c1-a3bf-36310c47f609';
  function accountBackend(initial: ReturnType<typeof saved>[], defaultLocationId: string | null = null) {
    let locations = [...initial];
    const added: unknown[] = [];
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/v1/settings`, () =>
        HttpResponse.json({
          defaultTradition: null,
          defaultLocationId,
          defaultLocation: locations.find((item) => item.locationId === defaultLocationId) ?? null,
          revision: 1,
          chartStyle: 'south-indian',
          ayanamsa: 'lahiri',
        }),
      ),
      http.get(`${TEST_API_BASE_URL}/api/v1/settings/locations`, () => HttpResponse.json(locations)),
      http.post(`${TEST_API_BASE_URL}/api/v1/settings/locations`, async ({ request }) => {
        const body = (await request.json()) as Omit<ReturnType<typeof saved>, 'locationId'>;
        added.push(body);
        const created = { ...body, locationId: `00000000-0000-4000-8000-00000000000${added.length}` };
        locations = [...locations, created];
        return HttpResponse.json(created);
      }),
    );
    return { added, locations: () => locations };
  }

  it('shows the default location in the header after login', async () => {
    accountBackend([saved(HYDERABAD_ID, hyderabad), saved(AUSTIN_ID, austin)], AUSTIN_ID);
    renderRoute('/');
    expect(
      await screen.findByRole('button', { name: /^Change location: Austin, Texas/ }),
    ).toBeInTheDocument();
  });

  it('shows the first saved location when no default is set, and lists saved locations in the picker', async () => {
    const backend = accountBackend([saved(HYDERABAD_ID, hyderabad), saved(AUSTIN_ID, austin)]);
    storeSelectedLocation(austin);
    renderRoute('/');
    expect(
      await screen.findByRole('button', { name: /^Change location: Hyderabad, Telangana/ }),
    ).toBeInTheDocument();
    const dialog = await openDialog();
    const recent = within(await within(dialog).findByRole('region', { name: 'Recent locations' }));
    expect(recent.getByRole('button', { name: /^Hyderabad, Telangana/ })).toBeInTheDocument();
    expect(recent.getByRole('button', { name: /^Austin, Texas/ })).toBeInTheDocument();
    expect(backend.added).toHaveLength(0);
  });

  it('keeps the existing location when the account has no saved locations', async () => {
    accountBackend([]);
    storeSelectedLocation(hyderabad);
    renderRoute('/');
    expect(
      await screen.findByRole('button', { name: 'Change location: Hyderabad, Telangana' }),
    ).toBeInTheDocument();
  });

  it('saves a location picked in the header once, and shows it in Settings without a refresh', async () => {
    const backend = accountBackend([]);
    const { router } = renderRoute('/');
    const dialog = await openDialog();
    await searchFor(dialog, 'Austin, TX');
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Use this location' }));
    await waitFor(() => expect(backend.added).toHaveLength(1));
    expect(backend.added[0]).toMatchObject({ city: 'Austin', state: 'Texas', countryCode: 'US' });

    // Picking the same place again (here from the saved list) never adds it twice.
    const reopened = await openDialog();
    const recent = await within(reopened).findByRole('region', { name: 'Recent locations' });
    await userEvent.click(within(recent).getByRole('button', { name: /^Austin, Texas/ }));

    await router.navigate('/settings');
    expect(await screen.findByRole('button', { name: /^Delete Austin, Texas/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Delete / })).toHaveLength(1);
    expect(backend.added).toHaveLength(1);
  });

  it('does not save the same place twice when it is found with slightly different coordinates', async () => {
    const backend = accountBackend([
      saved(AUSTIN_ID, austin, { latitude: 30.2672, longitude: -97.7431 }),
      saved(HYDERABAD_ID, hyderabad),
    ]);
    renderRoute('/');
    await screen.findByRole('button', { name: /^Change location: Austin, Texas/ });
    const dialog = await openDialog();
    await searchFor(dialog, 'Austin, TX');
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Use this location' }));
    expect(await screen.findByText('All times shown in local time — Austin, Texas')).toBeInTheDocument();
    await waitFor(() =>
      expect(apiRequests.some((u) => u.searchParams.get('place') === 'Austin, TX')).toBe(true),
    );
    expect(backend.added).toHaveLength(0);
    expect(backend.locations()).toHaveLength(2);
  });
});
