import { fireEvent, screen } from '@testing-library/react-native';

import TabsLayout from '../../../app/(tabs)/_layout';
import { createInMemoryAuthClient } from '../../shared/auth';
import { AppText } from '../../shared/components';
import { apiRequests, renderApp, storeLocation } from '../../test/render';
import { TodayDashboard } from './TodayDashboard';

const auth = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Token Name' } });

describe('native Today dashboard', () => {
  jest.setTimeout(15000);
  it('uses Profile in authenticated Today navigation and opens the profile route', async () => {
    await storeLocation();
    await renderApp(
      {
        '(tabs)/_layout': TabsLayout,
        '(tabs)/index': TodayDashboard,
        '(tabs)/calendar': () => <AppText>Calendar screen</AppText>,
        '(tabs)/good-time': () => <AppText>Good Time screen</AppText>,
        '(tabs)/festivals': () => <AppText>Events screen</AppText>,
        '(tabs)/more': () => <AppText>More screen</AppText>,
        profile: () => <AppText>Profile screen</AppText>,
      },
      { auth: auth() },
    );
    await screen.findByText('Namaste, Asha');
    expect(screen.getByLabelText('Upcoming Events')).toBeTruthy();
    expect(screen.queryByLabelText('Settings')).toBeNull();
    // The header button and the bottom tab both reach the same profile route.
    await fireEvent.press(screen.getAllByLabelText('Profile').at(-1)!);
    expect(await screen.findByText('Profile screen')).toBeTruthy();
  });
  it('uses API identity and date, renders every dashboard section, and expands complete information', async () => {
    await storeLocation();
    await renderApp({ index: TodayDashboard }, { auth: auth() });
    expect(await screen.findByText('Namaste, Asha')).toBeTruthy();
    expect(await screen.findByText('Tuesday, September 29')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change location: Austin, Texas' })).toBeTruthy();
    expect(await screen.findByText('Mixed')).toBeTruthy();
    expect(screen.getByText('September 29 timeline')).toBeTruthy();
    expect(screen.queryByText('Sunrise to next sunrise')).toBeNull();
    expect(screen.getByText('Auspicious times on September 29')).toBeTruthy();
    expect(screen.getByText('September 29 Panchang')).toBeTruthy();
    expect(screen.queryByText('Yoga')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Tithi:/ }));
    expect(await screen.findByText('Yoga')).toBeTruthy();
    expect(screen.getByText('Karana')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Times to avoid on September 29' }));
    expect(await screen.findByRole('button', { name: /^Rahu Kalam\./ })).toBeTruthy();
    expect(apiRequests.filter((url) => url.pathname.endsWith('/panchang/today'))).toHaveLength(1);
  });

  it('offers expanded timeline details without losing interval conflicts', async () => {
    await storeLocation();
    await renderApp({ index: TodayDashboard }, { auth: auth() });
    await fireEvent.press(await screen.findByRole('button', { name: 'View timeline details' }));
    expect(await screen.findAllByText(/Overlaps with/)).not.toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('button', { name: 'Find a Good Time' })).toBeTruthy();
  });
});
