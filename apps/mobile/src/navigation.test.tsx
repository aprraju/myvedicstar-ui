import { screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import * as ReactNative from 'react-native';

import RootLayout from '../app/_layout';
import TabsLayout from '../app/(tabs)/_layout';
import CalendarScreen from '../app/(tabs)/calendar';
import FestivalsScreen from '../app/(tabs)/festivals';
import GoodTimeScreen from '../app/(tabs)/good-time';
import TodayScreen from '../app/(tabs)/index';
import MoreScreen from '../app/(tabs)/more';

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': TodayScreen,
  '(tabs)/calendar': CalendarScreen,
  '(tabs)/good-time': GoodTimeScreen,
  '(tabs)/festivals': FestivalsScreen,
  '(tabs)/more': MoreScreen,
};

function setWindowWidth(width: number) {
  jest
    .spyOn(ReactNative, 'useWindowDimensions')
    .mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
}

describe('primary navigation', () => {
  afterEach(() => jest.restoreAllMocks());

  it('offers Today, Calendar, Good Time, Festivals and More with accessible labels', async () => {
    setWindowWidth(390);
    await renderRouter(routes, { initialUrl: '/' });
    for (const label of ['Today', 'Panchang', 'Good Time', 'Festivals', 'More']) {
      expect(await screen.findByLabelText(label)).toBeTruthy();
    }
    // Today shows the public summary for visitors.
    expect(
      await screen.findByRole('header', { name: 'Find Auspicious Moments for a Happier Life' }),
    ).toBeTruthy();
  });

  it('supports deep links to a tab', async () => {
    setWindowWidth(390);
    await renderRouter(routes, { initialUrl: '/calendar' });
    expect(await screen.findByRole('header', { name: 'Panchang' })).toBeTruthy();
  });

  it('keeps working when the window expands (e.g. a foldable unfolding)', async () => {
    setWindowWidth(884);
    await renderRouter(routes, { initialUrl: '/festivals' });
    expect(await screen.findByRole('header', { name: 'Festivals' })).toBeTruthy();
    expect(screen.getByLabelText('Today')).toBeTruthy();
  });
});
