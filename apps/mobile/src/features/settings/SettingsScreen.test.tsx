import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createInMemoryAuthClient } from '../../shared/auth';
import { apiRequests, renderApp } from '../../test/render';
import { SettingsScreen } from './SettingsScreen';

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
type SettingsBody = {
  defaultTradition: string | null;
  defaultLocationId: string | null;
  defaultLocation: typeof location | null;
  revision: number;
  chartStyle: string;
  ayanamsa: string;
};

describe('Settings on mobile', () => {
  it('loads saved defaults and saves explicitly', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    await renderApp(
      { settings: SettingsScreen },
      {
        auth,
        initialUrl: '/settings',
        fetchOverride: (url) =>
          url.pathname.endsWith('/settings')
            ? {
                status: 200,
                body: {
                  defaultTradition: 'telugu',
                  defaultLocationId: location.locationId,
                  defaultLocation: location,
                  revision: 2,
                  chartStyle: 'south-indian',
                  ayanamsa: 'lahiri',
                },
              }
            : url.pathname.endsWith('/settings/locations')
              ? { status: 200, body: [location] }
              : undefined,
      },
    );
    await screen.findByText('Default Tradition');
    const save = await screen.findByRole('button', { name: 'Save' });
    await waitFor(() => expect(save).toBeEnabled());
    await fireEvent.press(save);
    expect(await screen.findByText('Your settings have been saved.')).toBeTruthy();
    expect(apiRequests.filter((url) => url.pathname.endsWith('/settings')).length).toBeGreaterThanOrEqual(2);
  });
  function backend() {
    const settings: SettingsBody = {
      defaultTradition: 'telugu',
      defaultLocationId: location.locationId,
      defaultLocation: location,
      revision: 2,
      chartStyle: 'south-indian',
      ayanamsa: 'lahiri',
    };
    const saves: unknown[] = [];
    const fetchOverride = (url: URL) => {
      if (url.pathname.endsWith('/settings') && url.search === '') return { status: 200, body: settings };
      if (url.pathname.endsWith('/settings/locations')) return { status: 200, body: [location] };
      return undefined;
    };
    return { saves, fetchOverride };
  }
  it('shows Chart Style and Ayanamsa radiogroups with the stored selection', async () => {
    const { fetchOverride } = backend();
    await renderApp(
      { settings: SettingsScreen },
      {
        auth: createInMemoryAuthClient({ user: { id: 'u1' } }),
        initialUrl: '/settings',
        fetchOverride,
      },
    );
    expect(await screen.findByText('Chart Style')).toBeTruthy();
    expect(screen.getByText('Ayanamsa')).toBeTruthy();
    expect(screen.getByText('Krishnamurti (KP)')).toBeTruthy();
    expect(screen.getAllByText('North Indian').length).toBeGreaterThan(0);
    expect(screen.getAllByText('East Indian').length).toBeGreaterThan(0);
    expect(screen.getByText('N.C. Lahiri')).toBeTruthy();
  });
  it('exposes selection and disabled state on the preference options', async () => {
    const { fetchOverride } = backend();
    await renderApp(
      { settings: SettingsScreen },
      {
        auth: createInMemoryAuthClient({ user: { id: 'u1' } }),
        initialUrl: '/settings',
        fetchOverride,
      },
    );
    await screen.findByText('Chart Style');
    const options = screen.getAllByRole('button');
    const south = options.find((option) => option.props.accessibilityLabel === 'South Indian');
    const north = options.find((option) => option.props.accessibilityLabel === 'North Indian');
    expect(south?.props.accessibilityState).toMatchObject({ checked: true, disabled: false });
    expect(north?.props.accessibilityState).toMatchObject({ checked: false, disabled: false });
    const lahiri = options.find((option) => option.props.accessibilityLabel === 'N.C. Lahiri');
    expect(lahiri?.props.accessibilityState).toMatchObject({ checked: true });
  });
  it('saves a changed Ayanamsa and keeps the radiogroup usable', async () => {
    const { fetchOverride } = backend();
    await renderApp(
      { settings: SettingsScreen },
      {
        auth: createInMemoryAuthClient({ user: { id: 'u1' } }),
        initialUrl: '/settings',
        fetchOverride,
      },
    );
    const save = await screen.findByRole('button', { name: 'Save' });
    await waitFor(() => expect(save).toBeEnabled());
    await fireEvent.press(screen.getByText('Raman'));
    await fireEvent.press(save);
    expect(await screen.findByText('Your settings have been saved.')).toBeTruthy();
  });
  it('requires sign-in without requesting private settings', async () => {
    await renderApp({ settings: SettingsScreen }, { initialUrl: '/settings' });
    expect(await screen.findByText('Sign in to manage your settings.')).toBeTruthy();
    expect(apiRequests.filter((url) => url.pathname.endsWith('/settings'))).toHaveLength(0);
  });
});
