import Ionicons from '@expo/vector-icons/Ionicons';
import type { Glossary } from '@myvedicstar/contracts';
import { formatRangeForDay, type LocalDate } from '@myvedicstar/date-time';
import { mobilePeriodOrder, type PeriodItem } from '@myvedicstar/domain-models';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button } from '../../shared/components';
import { useTranslation } from '../../shared/i18n';
import { useTheme } from '../../shared/theme';

/** All intervals and conflict warnings are supplied unchanged by the shared dashboard model. */
export function PeriodCard({
  title,
  items,
  glossary,
  timeZone,
  date,
  previewCount,
}: {
  title: string;
  items: readonly PeriodItem[];
  glossary: Glossary | undefined;
  timeZone: string;
  date: LocalDate;
  previewCount?: number;
}) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<string>();
  const ordered = mobilePeriodOrder(items);
  const visible = previewCount && !expanded ? ordered.slice(0, previewCount) : ordered;
  const range = (start: string, end: string) =>
    formatRangeForDay(start, end, { timeZone, locale }, date, t('summary.nextDay'));
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: 1,
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
          {title}
        </AppText>
        {previewCount && items.length > 0 && (
          <Button
            variant="ghost"
            label={t(expanded ? 'dashboard.showLess' : 'dashboard.seeAll')}
            expanded={expanded}
            onPress={() => setExpanded(!expanded)}
          />
        )}
      </View>
      {visible.length === 0 && <AppText variant="secondary">{t('dashboard.noneToday')}</AppText>}
      {visible.map((item) => {
        const { period, state, tone, overlaps } = item;
        const key = `${period.kind}-${period.start}`;
        const fg =
          tone === 'neutral' || (state === 'past' && tone !== 'warning')
            ? theme.colors.textSecondary
            : theme.colors[tone];
        const message = glossary?.periods?.[period.kind]?.message;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ expanded: detail === key }}
            accessibilityLabel={`${period.name}. ${range(period.start, period.end)}. ${t(state === 'now' ? 'dashboard.active' : state === 'past' ? 'dashboard.over' : 'dashboard.upcoming')}`}
            onPress={() => setDetail(detail === key ? undefined : key)}
            style={{
              flexDirection: 'row',
              gap: theme.spacing.sm,
              minHeight: theme.touchTarget.minimum,
              paddingVertical: theme.spacing.sm,
              borderTopWidth: 1,
              borderColor: theme.colors.border,
              opacity: 1,
            }}
          >
            <Ionicons
              name={tone === 'warning' || tone === 'caution' ? 'warning-outline' : 'time-outline'}
              color={fg}
              size={23}
            />
            <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xxs }}>
              <AppText variant="label">
                {period.name} ·{' '}
                {t(
                  state === 'now'
                    ? 'dashboard.active'
                    : state === 'past'
                      ? 'dashboard.over'
                      : 'dashboard.upcoming',
                )}
              </AppText>
              <AppText>{range(period.start, period.end)}</AppText>
              {!overlaps.length && message && <AppText variant="secondary">{message}</AppText>}
              {overlaps.map((overlap) => (
                <AppText
                  key={`${overlap.kind}-${overlap.start}`}
                  variant="secondary"
                  style={{ color: theme.colors.warning }}
                >
                  {t('dashboard.overlapsWith', {
                    name: overlap.name,
                    time: range(overlap.start, overlap.end),
                  })}
                </AppText>
              ))}
              {detail === key && (
                <AppText variant="secondary">{glossary?.periods?.[period.kind]?.meaning ?? timeZone}</AppText>
              )}
            </View>
            <Ionicons name="chevron-forward" color={theme.colors.textSecondary} size={16} />
          </Pressable>
        );
      })}
    </View>
  );
}
