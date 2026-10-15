import Ionicons from '@expo/vector-icons/Ionicons';
import { queryKeys } from '@myvedicstar/api-client';
import { formatDayMonth, formatLocalDate } from '@myvedicstar/date-time';
import {
  buildDayDashboard,
  dashboardFactorReason,
  dashboardFirstName,
  toneForRating,
} from '@myvedicstar/domain-models';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { ImageBackground, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import dashboardImage from '../../../assets/images/dashboard.jpg';
import { useAuth } from '../../shared/auth';
import { AppText, Button, Screen } from '../../shared/components';
import { useTranslation } from '../../shared/i18n';
import { useServices } from '../../shared/services';
import { statusToneColors } from '../../shared/statusTone';
import { useTheme } from '../../shared/theme';
import { useLocationState } from '../location/LocationProvider';
import { DaySummaryCard } from '../today/DaySummaryCard';
import { useNow, usePanchangToday } from '../today/usePanchangToday';
import { TraditionPicker } from '../tradition/TraditionProvider';
import { MobileTimeline } from './MobileTimeline';
import { PanchangCard } from './PanchangCard';
import { PeriodCard } from './PeriodCard';

/** Authenticated native Today, composed from the same API-backed dashboard model as desktop. */
export function TodayDashboard() {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(theme.dark ? 'light' : 'dark');
    }, [theme.dark]),
  );
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { api } = useServices();
  const { query, location } = usePanchangToday();
  const { openSheet } = useLocationState();
  const now = useNow();
  const dashboard = useMemo(
    () => (query.data ? buildDayDashboard(query.data, now) : undefined),
    [query.data, now],
  );
  const { data: userInfo } = useQuery({
    queryKey: queryKeys.auth.userInfo(user?.id ?? 'signed-out'),
    queryFn: ({ signal }) => api.auth.userInfo({ signal }),
    enabled: !!user && !loading,
    staleTime: Infinity,
    retry: false,
  });
  const name = dashboardFirstName(userInfo?.name?.trim() || userInfo?.givenName?.trim() || user?.displayName);
  const summary = dashboard?.summary;
  const glossary = query.data?.glossary;
  return (
    <Screen padding={0}>
      <ImageBackground source={dashboardImage} style={{ backgroundColor: theme.colors.heroOverlay }}>
        <View
          style={{
            padding: theme.spacing.md,
            paddingTop: theme.spacing.md + insets.top,
            backgroundColor: `${theme.colors.heroOverlay}CC`,
            gap: theme.spacing.xs,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            <AppText style={{ color: theme.colors.heroForeground, flex: 1 }}>
              {name ? t('dashboard.greeting', { name }) : t('dashboard.greetingAnonymous')}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nav.profile')}
              onPress={() => router.push('/profile')}
              style={{
                minHeight: theme.touchTarget.minimum,
                minWidth: theme.touchTarget.minimum,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="person-outline" color={theme.colors.heroForeground} size={23} />
            </Pressable>
          </View>
          {summary && (
            <>
              <AppText variant="title" style={{ color: theme.colors.heroForeground }}>
                {formatLocalDate(summary.date, locale)}
              </AppText>
              <AppText style={{ color: theme.colors.heroForeground }}>
                {[summary.paksha && t(`summary.paksha.${summary.paksha}`), summary.tithi?.current.name]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
            </>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              location ? t('location.change', { location: location.label }) : t('location.choose')
            }
            onPress={openSheet}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: theme.touchTarget.minimum,
              gap: theme.spacing.xs,
            }}
          >
            <Ionicons name="location-outline" color={theme.colors.heroForeground} size={19} />
            <AppText style={{ color: theme.colors.heroForeground, flex: 1 }}>
              {location?.fullName ?? location?.label ?? t('location.choose')}
            </AppText>
            <Ionicons name="chevron-down" color={theme.colors.heroForeground} size={18} />
          </Pressable>
          <TraditionPicker />
        </View>
      </ImageBackground>
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        <DaySummaryCard mobile onFindGoodTime={() => router.push('/good-time')} />
        {dashboard && location && (
          <>
            <MobileTimeline dashboard={dashboard} timeZone={location.timeZone} glossary={glossary} />
            <PeriodCard
              title={t('dashboard.auspiciousTitle', { day: formatDayMonth(dashboard.summary.date, locale) })}
              items={dashboard.auspicious}
              glossary={glossary}
              timeZone={location.timeZone}
              date={dashboard.summary.date}
              previewCount={3}
            />
            <PanchangCard dashboard={dashboard} timeZone={location.timeZone} />
            <Disclosure
              title={t('dashboard.avoidTitle', { day: formatDayMonth(dashboard.summary.date, locale) })}
            >
              <PeriodCard
                title={t('dashboard.avoidTitle', { day: formatDayMonth(dashboard.summary.date, locale) })}
                items={dashboard.avoid}
                glossary={glossary}
                timeZone={location.timeZone}
                date={dashboard.summary.date}
              />
            </Disclosure>
            <Disclosure
              title={t('dashboard.factorsTitle', {
                day: formatDayMonth(dashboard.summary.date, locale),
                rating: dashboard.ratingName,
              })}
            >
              {dashboard.factors.map((factor) => {
                const colors = statusToneColors(theme, toneForRating(factor.rating));
                return (
                  <View
                    key={`${factor.limb}-${factor.key}`}
                    style={{
                      padding: theme.spacing.sm,
                      backgroundColor: colors.bg,
                      borderRadius: theme.radius.md,
                      gap: theme.spacing.xs,
                    }}
                  >
                    <AppText variant="label" style={{ color: colors.fg }}>
                      {factor.limbName}: {factor.name} · {factor.ratingName}
                    </AppText>
                    <AppText>{dashboardFactorReason(factor)}</AppText>
                  </View>
                );
              })}
            </Disclosure>
          </>
        )}
      </View>
    </Screen>
  );
}

function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        padding: theme.spacing.sm,
        gap: theme.spacing.sm,
      }}
    >
      <Button
        variant="ghost"
        label={title}
        expanded={expanded}
        icon={expanded ? 'chevron-up' : 'chevron-down'}
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && children}
    </View>
  );
}
