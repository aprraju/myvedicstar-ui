import Ionicons from '@expo/vector-icons/Ionicons';
import { supportsTwoPanes } from '@myvedicstar/design-tokens';
import { Tabs, usePathname, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';

import { useAuth } from '../../src/shared/auth';
import { useTranslation } from '../../src/shared/i18n';
import { useTheme, useWindowClass } from '../../src/shared/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tabs: {
  name: string;
  titleKey: 'nav.today' | 'nav.calendar' | 'nav.goodTime' | 'nav.festivals' | 'nav.more';
  icon: IconName;
}[] = [
  { name: 'index', titleKey: 'nav.today', icon: 'sunny-outline' },
  { name: 'calendar', titleKey: 'nav.calendar', icon: 'calendar-outline' },
  { name: 'good-time', titleKey: 'nav.goodTime', icon: 'time-outline' },
  { name: 'festivals', titleKey: 'nav.festivals', icon: 'sparkles-outline' },
  { name: 'more', titleKey: 'nav.more', icon: 'ellipsis-horizontal' },
];

/**
 * Primary navigation: Today, Calendar, Good Time, Festivals, More.
 * Compact windows (phones, folded outer screens) use a bottom tab bar; when the window is wide enough
 * (tablets, unfolded foldables, landscape) the tabs move to a side rail so content gets the width.
 */
export default function TabsLayout() {
  const { isAuthenticated } = useAuth();
  const today = usePathname() === '/' && isAuthenticated;
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const wide = supportsTwoPanes(useWindowClass());

  return (
    <Tabs
      screenOptions={{
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        tabBarAllowFontScaling: true,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.primary,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          listeners={{
            tabPress: (event) => {
              if (today && tab.name === 'more') {
                event.preventDefault();
                router.push('/profile');
              }
            },
          }}
          options={{
            ...(tab.name === 'index' && isAuthenticated ? { headerShown: false } : {}),
            title: t(
              today && tab.name === 'more'
                ? 'nav.profile'
                : today && tab.name === 'festivals'
                  ? 'nav.upcomingEvents'
                  : tab.titleKey,
            ),
            tabBarAccessibilityLabel: t(
              today && tab.name === 'more'
                ? 'nav.profile'
                : today && tab.name === 'festivals'
                  ? 'nav.upcomingEvents'
                  : tab.titleKey,
            ),
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={today && tab.name === 'more' ? 'person-outline' : tab.icon}
                color={color}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
