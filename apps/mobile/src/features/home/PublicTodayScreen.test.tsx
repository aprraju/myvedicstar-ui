import { fixtures } from '@myvedicstar/testing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createInMemoryAuthClient, SignInCancelled } from '../../shared/auth';
import {
  apiRequests,
  atInstant,
  fakeGeolocation,
  hyderabad,
  renderApp,
  storeLocation,
} from '../../test/render';
import { AuthScreen } from '../auth/AuthScreen';
import { PublicTodayScreen } from './PublicTodayScreen';

const routes = {
  index: PublicTodayScreen,
  login: () => <AuthScreen intent="login" />,
  register: () => <AuthScreen intent="register" />,
  'good-time': () => <Text accessibilityRole="header">Good Time screen</Text>,
};

describe('public Today (mobile)', () => {
  it('answers how today is, whether now is good, and the next caution period', async () => {
    atInstant('2026-09-29T10:00:00-05:00');
    await storeLocation();
    await renderApp(routes);

    expect(await screen.findByText('Mixed day')).toBeTruthy();
    expect(screen.getByText('Tuesday, September 29')).toBeTruthy();
    expect(screen.getByText('Krishna Paksha · Krishna Chaturthi')).toBeTruthy();
    // Signed-out visitors use only today's embedded evaluation.
    expect(await screen.findByLabelText(/No more recommended times today/)).toBeTruthy();
    expect(
      apiRequests.every(
        (url) => url.pathname.endsWith('/panchang/today') || url.pathname.endsWith('/locations/resolve'),
      ),
    ).toBe(true);
    expect(
      screen.getByLabelText(/Use caution now\. Durmuhurtham 09:46\sAM – 10:34\sAM\. Unfavorable Muhurta/),
    ).toBeTruthy();
    expect(screen.getByText('All times shown in local time — Austin, Texas')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change location: Austin, Texas' })).toBeTruthy();
  });

  it('asks for a location when none is known and permission is unavailable', async () => {
    await renderApp(routes, { geolocation: fakeGeolocation({ permission: 'unsupported' }) });
    expect(await screen.findByText('Choose a location to see today’s Panchang')).toBeTruthy();
    expect(apiRequests.some((u) => u.pathname.includes('/panchang'))).toBe(false);
  });

  it('detects the current location on first launch when the OS allows it', async () => {
    const geolocation = fakeGeolocation({
      permission: 'granted',
      position: { latitude: 17.385, longitude: 78.4867 },
    });
    await renderApp(routes, { geolocation });
    expect(await screen.findByText('All times shown in local time — Hyderabad, Telangana')).toBeTruthy();
    expect(geolocation.requests).toBe(1);
  });

  it('explains a denied permission and never asks again automatically', async () => {
    await renderApp(routes, {
      geolocation: fakeGeolocation({ permission: 'prompt', error: 'permissionDenied' }),
    });
    expect(await screen.findByText(/Location access is turned off/)).toBeTruthy();
  });

  it('shows a friendly error with retry', async () => {
    await storeLocation();
    let fail = true;
    await renderApp(routes, {
      fetchOverride: (url) =>
        fail && url.pathname.endsWith('/panchang/today')
          ? { status: 503, body: { status: 503, title: 'Unavailable' } }
          : undefined,
    });
    expect(await screen.findByText("We couldn't load today's Panchang.")).toBeTruthy();
    expect(screen.queryByText('Unavailable')).toBeNull();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Mixed day')).toBeTruthy();
  });

  it.each([
    ['austinHighlyFavorable', 'Highly favorable day'],
    ['austinCaution', 'Mixed day'],
    ['austinAvoid', 'Traditionally avoided for new beginnings'],
  ] as const)('shows the General status of %s as the day headline', async (fixture, headline) => {
    const response = fixtures.panchang[fixture];
    const date = response.days[0]!.date;
    atInstant(`${date}T12:00:00-05:00`);
    await storeLocation();
    await renderApp(routes, {
      fetchOverride: (url) =>
        url.pathname.endsWith('/panchang/today')
          ? { status: 200, body: { ...response, localToday: date } }
          : undefined,
    });
    expect(await screen.findByText(headline)).toBeTruthy();
  });
});

describe('location sheet (mobile)', () => {
  it('searches, confirms and switches location', async () => {
    await storeLocation();
    await renderApp(routes);
    await fireEvent.press(await screen.findByRole('button', { name: 'Change location: Austin, Texas' }));
    await fireEvent.changeText(
      await screen.findByLabelText('City, ZIP code or coordinates'),
      'Hyderabad, Telangana, India',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Use this location' }));
    expect(await screen.findByText('All times shown in local time — Hyderabad, Telangana')).toBeTruthy();
  });

  it('explains that ZIP codes are not searchable yet', async () => {
    await storeLocation();
    await renderApp(routes);
    await fireEvent.press(await screen.findByRole('button', { name: 'Change location: Austin, Texas' }));
    await fireEvent.changeText(await screen.findByLabelText('City, ZIP code or coordinates'), '78701');
    await fireEvent.press(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/ZIP or postal code isn’t available yet/)).toBeTruthy();
  });

  it('validates latitude and longitude', async () => {
    await storeLocation();
    await renderApp(routes);
    await fireEvent.press(await screen.findByRole('button', { name: 'Change location: Austin, Texas' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Enter latitude and longitude' }));
    await fireEvent.changeText(await screen.findByLabelText('Latitude'), '95');
    await fireEvent.changeText(screen.getByLabelText('Longitude'), '78.4');
    await fireEvent.press(screen.getByRole('button', { name: 'Use these coordinates' }));
    expect(await screen.findByText('Latitude must be between -90 and 90.')).toBeTruthy();
  });

  it('offers recent locations', async () => {
    await storeLocation();
    await AsyncStorage.setItem('mvs.location.recent', JSON.stringify([hyderabad]));
    await renderApp(routes);
    await fireEvent.press(await screen.findByRole('button', { name: 'Change location: Austin, Texas' }));
    await fireEvent.press(await screen.findByText('Hyderabad, Telangana, India'));
    expect(await screen.findByRole('button', { name: 'Change location: Hyderabad, Telangana' })).toBeTruthy();
  });
});

describe('tradition (mobile)', () => {
  it('changes tradition independently of location and reloads the Panchang', async () => {
    await storeLocation();
    await renderApp(routes, { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    await screen.findByText('Mixed day');
    await fireEvent.press(screen.getByRole('button', { name: /^Tradition: / }));
    await fireEvent.press(await screen.findByRole('radio', { name: /Tamil/ }));
    await waitFor(() =>
      expect(
        apiRequests.some(
          (u) => u.pathname.endsWith('/panchang/today') && u.searchParams.get('tradition') === 'tamil',
        ),
      ).toBe(true),
    );
    expect(screen.getByRole('button', { name: 'Tradition: Tamil' })).toBeTruthy();
  });
});

describe('sign-in (mobile)', () => {
  it('shows a clear message when sign-in is not configured', async () => {
    await renderApp(routes, { initialUrl: '/login' });
    expect(await screen.findByText('Sign-in is not available yet in this environment.')).toBeTruthy();
  });

  it('validates the email hint', async () => {
    const auth = createInMemoryAuthClient({ providers: ['email'] });
    await renderApp(routes, { initialUrl: '/login', auth });
    await fireEvent.changeText(await screen.findByLabelText('Email'), 'nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/Enter a valid email address/)).toBeTruthy();
    expect(auth.requests).toHaveLength(0);
  });

  it('Find a Good Time → Login → back to Good Time', async () => {
    await storeLocation();
    const auth = createInMemoryAuthClient({ providers: ['email', 'google'] });
    await renderApp(routes, { auth });
    await fireEvent.press(await screen.findByRole('button', { name: 'Find a Good Time' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByText('Good Time screen')).toBeTruthy();
    expect(auth.requests[0]).toMatchObject({ intent: 'login', provider: 'google' });
  });

  it('starts registration with the register intent and email hint', async () => {
    const auth = createInMemoryAuthClient({ providers: ['email'] });
    await renderApp(routes, { initialUrl: '/register', auth });
    expect(await screen.findByText('Create your account')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'devotee@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() =>
      expect(auth.requests[0]).toEqual({
        intent: 'register',
        provider: 'email',
        loginHint: 'devotee@example.com',
      }),
    );
  });

  it('reports a cancelled sign-in', async () => {
    const auth = createInMemoryAuthClient({ providers: ['google'] });
    auth.signIn = jest.fn().mockRejectedValue(new SignInCancelled());
    await renderApp(routes, { initialUrl: '/login', auth });
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue with Google' }));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Sign-in was cancelled/)).toBeTruthy();
  });
});
