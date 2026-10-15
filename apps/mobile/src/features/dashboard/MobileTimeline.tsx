import type { Glossary } from '@myvedicstar/contracts';
import { formatDayMonth, formatTime } from '@myvedicstar/date-time';
import type { DayDashboard } from '@myvedicstar/domain-models';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Sheet } from '../../shared/components';
import { useTranslation } from '../../shared/i18n';
import { useTheme } from '../../shared/theme';
import { PeriodCard } from './PeriodCard';

/** Scaled positions, midnight boundaries and overlaps come from the existing shared timeline model. */
export function MobileTimeline({
  dashboard,
  timeZone,
  glossary,
}: {
  dashboard: DayDashboard;
  timeZone: string;
  glossary: Glossary | undefined;
}) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const { timeline } = dashboard;
  const time = (instant: string) => formatTime(instant, { timeZone, locale });
  return (
    <>
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
      >
        <AppText variant="heading">
          {t('dashboard.timelineTitle', { day: formatDayMonth(dashboard.summary.date, locale) })}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.timelineDetails')}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(true)}
          style={{ minHeight: theme.touchTarget.minimum, paddingTop: 32 }}
        >
          <View
            style={{ height: 42, backgroundColor: theme.colors.surfaceSubtle, borderRadius: theme.radius.sm }}
          >
            {timeline.entries.map((entry) => (
              <View
                key={`${entry.period.kind}-${entry.period.start}`}
                style={{
                  position: 'absolute',
                  left: `${entry.from * 100}%`,
                  width: `${(entry.to - entry.from) * 100}%`,
                  top: entry.tone === 'caution' ? 28 : entry.tone === 'warning' ? 14 : 0,
                  height: 12,
                  minWidth: 2,
                  borderRadius: theme.radius.sm,
                  backgroundColor:
                    entry.tone === 'neutral' ? theme.colors.borderStrong : theme.colors[entry.tone],
                  opacity: entry.state === 'past' ? 0.5 : 1,
                }}
              />
            ))}
            <View
              style={{
                position: 'absolute',
                left: `${timeline.sunsetAt * 100}%`,
                width: 1,
                height: 42,
                backgroundColor: theme.colors.textSecondary,
              }}
            />
            {timeline.nowAt !== undefined && (
              <View
                style={{
                  position: 'absolute',
                  left: `${timeline.nowAt * 100}%`,
                  width: 2,
                  top: -5,
                  bottom: -5,
                  backgroundColor: theme.colors.info,
                }}
              >
                <AppText
                  variant="label"
                  style={{
                    position: 'absolute',
                    top: -28,
                    left: timeline.nowAt < 0.1 ? 0 : timeline.nowAt > 0.9 ? -35 : -18,
                    color: theme.colors.onPrimary,
                    backgroundColor: theme.colors.info,
                    paddingHorizontal: theme.spacing.xxs,
                    borderRadius: theme.radius.sm,
                  }}
                >
                  {t('dashboard.now')}
                </AppText>
              </View>
            )}
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: theme.spacing.xs,
              paddingTop: theme.spacing.sm,
            }}
          >
            {(
              [
                [t('dashboard.limbs.sunrise'), timeline.start],
                [t('dashboard.limbs.sunset'), timeline.sunset],
                [t('dashboard.nextSunrise'), timeline.end],
              ] as const
            ).map(([label, instant], index) => (
              <AppText
                key={label}
                variant="secondary"
                style={{
                  flex: 1,
                  fontSize: theme.fontSize.xs,
                  textAlign: index === 0 ? 'left' : index === 1 ? 'center' : 'right',
                }}
              >
                {label}
                {'\n'}
                {time(instant)}
              </AppText>
            ))}
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {(['favorable', 'warning', 'caution'] as const).map((tone) => (
            <View key={tone} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs }}>
              <View
                style={{
                  width: 9,
                  height: 9,
                  backgroundColor: theme.colors[tone],
                  borderRadius: theme.radius.sm,
                }}
              />
              <AppText variant="secondary" style={{ fontSize: theme.fontSize.xs }}>
                {t(
                  tone === 'favorable'
                    ? 'dashboard.timelineLegendFavorable'
                    : tone === 'warning'
                      ? 'dashboard.timelineLegendWarning'
                      : 'dashboard.timelineLegendCaution',
                )}
              </AppText>
            </View>
          ))}
        </View>
      </View>
      <Sheet
        visible={expanded}
        title={t('dashboard.timelineTitle', { day: formatDayMonth(dashboard.summary.date, locale) })}
        onClose={() => setExpanded(false)}
      >
        <PeriodCard
          title={t('dashboard.auspiciousTitle', { day: formatDayMonth(dashboard.summary.date, locale) })}
          items={dashboard.auspicious}
          glossary={glossary}
          timeZone={timeZone}
          date={dashboard.summary.date}
        />
        <PeriodCard
          title={t('dashboard.avoidTitle', { day: formatDayMonth(dashboard.summary.date, locale) })}
          items={dashboard.avoid}
          glossary={glossary}
          timeZone={timeZone}
          date={dashboard.summary.date}
        />
      </Sheet>
    </>
  );
}
