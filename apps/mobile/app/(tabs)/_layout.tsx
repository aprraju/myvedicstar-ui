import Ionicons from '@expo/vector-icons/Ionicons';
import { supportsTwoPanes } from '@myvedicstar/design-tokens';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

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
          options={{
            title: t(tab.titleKey),
            tabBarAccessibilityLabel: t(tab.titleKey),
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
