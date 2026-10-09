import Ionicons from '@expo/vector-icons/Ionicons';
import { supportsTwoPanes } from '@myvedicstar/design-tokens';
import type { MessageKey } from '@myvedicstar/localization';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '../../shared/auth';
import { AppText, Button, type IconName, Screen } from '../../shared/components';
import { useTranslation } from '../../shared/i18n';
import { useTheme, useWindowClass } from '../../shared/theme';
import { useLocationState } from '../location/LocationProvider';
import { DaySummaryCard } from '../today/DaySummaryCard';
import { TraditionPicker } from '../tradition/TraditionProvider';

const FEATURES: { id: string; icon: IconName }[] = [
  { id: 'today', icon: 'sunny-outline' },
  { id: 'goodTime', icon: 'time-outline' },
  { id: 'calendar', icon: 'calendar-outline' },
  { id: 'festivals', icon: 'sparkles-outline' },
  { id: 'locations', icon: 'globe-outline' },
  { id: 'traditions', icon: 'book-outline' },
];

/**
 * Today tab for visitors: compact header (location, tradition), hero, ONE Panchang card, a short feature overview and
 * Login/Register. Two panes (hero | card) when the window is wide enough — tablets and unfolded foldables.
 */
export function PublicTodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const wide = supportsTwoPanes(useWindowClass());

  const findGoodTime = () =>
    isAuthenticated
      ? router.push('/good-time' as Href)
      : router.push({ pathname: '/login', params: { returnTo: '/good-time' } } as Href);

  const hero = (
    <View style={styles.hero}>
      <AppText variant="display">{t('home.heroTitle')}</AppText>
      <AppText variant="secondary">{t('home.heroBody')}</AppText>
    </View>
  );

  return (
    <Screen>
      <ContextBar />
      {wide ? (
        <View style={styles.twoPane}>
          <View style={styles.pane}>{hero}</View>
          <View style={styles.pane}>
            <DaySummaryCard onFindGoodTime={findGoodTime} />
          </View>
        </View>
      ) : (
        <>
          {hero}
          <DaySummaryCard onFindGoodTime={findGoodTime} />
        </>
      )}
      <Features />
      {!isAuthenticated && (
        <View style={styles.auth}>
          <Button label={t('auth.register')} onPress={() => router.push('/register' as Href)} />
          <Button variant="secondary" label={t('auth.login')} onPress={() => router.push('/login' as Href)} />
        </View>
      )}
    </Screen>
  );
}

function ContextBar() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { location, detecting, openSheet } = useLocationState();
  const label = detecting && !location ? t('location.locating') : (location?.label ?? t('location.choose'));
  return (
    <View style={styles.contextBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          location ? t('location.change', { location: location.label }) : t('location.choose')
        }
        onPress={openSheet}
        style={[
          styles.pill,
          {
            minHeight: theme.touchTarget.minimum,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Ionicons
          name={location?.source === 'current' ? 'locate-outline' : 'location-outline'}
          size={18}
          color={theme.colors.primary}
        />
        <AppText numberOfLines={1} style={[styles.shrink, { color: theme.colors.primary }]}>
          {label}
        </AppText>
        <Ionicons name="chevron-down" size={16} color={theme.colors.primary} />
      </Pressable>
      <TraditionPicker />
    </View>
  );
}

function Features() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.features}>
      <AppText variant="title">{t('home.featuresTitle')}</AppText>
      <View style={styles.featureGrid}>
        {FEATURES.map(({ id, icon }) => (
          <View
            key={id}
            accessible
            style={[
              styles.feature,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
              },
            ]}
          >
            <Ionicons name={icon} size={24} color={theme.colors.secondary} />
            <AppText variant="heading">{t(`home.features.${id}.title` as MessageKey)}</AppText>
            <AppText variant="secondary">{t(`home.features.${id}.body` as MessageKey)}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8 },
  twoPane: { flexDirection: 'row', gap: 24, alignItems: 'center' },
  pane: { flex: 1 },
  contextBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
    flexShrink: 1,
  },
  shrink: { flexShrink: 1 },
  features: { gap: 12, marginTop: 8 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  feature: { flexGrow: 1, flexBasis: 260, gap: 6, padding: 16, borderWidth: 1 },
  auth: { gap: 10, marginTop: 8 },
});
