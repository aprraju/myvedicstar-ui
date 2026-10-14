import Ionicons from '@expo/vector-icons/Ionicons';
import { formatTime } from '@myvedicstar/date-time';
import type { DayDashboard } from '@myvedicstar/domain-models';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button } from '../../shared/components';
import { useTranslation } from '../../shared/i18n';
import { useTheme } from '../../shared/theme';

export function PanchangCard({ dashboard, timeZone }: { dashboard: DayDashboard; timeZone: string }) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const time = (instant: string) => formatTime(instant, { timeZone, locale });
  const keys = expanded
    ? (['tithi', 'nakshatra', 'yoga', 'karana'] as const)
    : (['tithi', 'nakshatra'] as const);
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        padding: theme.spacing.sm,
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
        <AppText variant="heading" style={{ flex: 1 }}>
          {t('dashboard.panchangTitle')}
        </AppText>
        <Button
          variant="ghost"
          label={t(expanded ? 'dashboard.showLess' : 'dashboard.seeAll')}
          expanded={expanded}
          onPress={() => setExpanded(!expanded)}
        />
      </View>
      {keys.map((key) => {
        const element = dashboard.limbs[key];
        return element ? (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`${t(`dashboard.limbs.${key}`)}: ${element.current.name}`}
            onPress={() => setExpanded(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              minHeight: theme.touchTarget.minimum,
              paddingVertical: theme.spacing.sm,
              borderTopWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Ionicons
              name={
                key === 'tithi'
                  ? 'moon-outline'
                  : key === 'nakshatra'
                    ? 'star-outline'
                    : key === 'yoga'
                      ? 'sparkles-outline'
                      : 'time-outline'
              }
              size={20}
              color={theme.colors.primary}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="secondary">{t(`dashboard.limbs.${key}`)}</AppText>
              <AppText variant="label">{element.current.name}</AppText>
              <AppText variant="secondary">
                {t('dashboard.until', { time: time(element.current.end) })}
                {expanded && element.next ? ` · ${t('dashboard.thenNext', { name: element.next.name })}` : ''}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </Pressable>
        ) : null;
      })}
      {expanded && (
        <View style={{ gap: theme.spacing.xs, paddingVertical: theme.spacing.sm }}>
          <AppText>
            {t('dashboard.limbs.vara')}: {dashboard.weekdayName}
          </AppText>
          {dashboard.summary.paksha && (
            <AppText>
              {t('dashboard.limbs.paksha')}: {t(`summary.paksha.${dashboard.summary.paksha}`)}
            </AppText>
          )}
          <AppText>
            {t('dashboard.limbs.sunrise')}: {time(dashboard.sunrise)}
          </AppText>
          <AppText>
            {t('dashboard.limbs.sunset')}: {time(dashboard.sunset)}
          </AppText>
          <AppText>
            {t('dashboard.nextSunrise')}: {time(dashboard.nextSunrise)}
          </AppText>
        </View>
      )}
    </View>
  );
}
