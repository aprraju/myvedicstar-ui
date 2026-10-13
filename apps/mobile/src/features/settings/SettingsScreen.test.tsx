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
  it('requires sign-in without requesting private settings', async () => {
    await renderApp({ settings: SettingsScreen }, { initialUrl: '/settings' });
    expect(await screen.findByText('Sign in to manage your settings.')).toBeTruthy();
    expect(apiRequests.filter((url) => url.pathname.endsWith('/settings'))).toHaveLength(0);
  });
});
