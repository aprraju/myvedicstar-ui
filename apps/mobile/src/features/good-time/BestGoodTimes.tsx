import Ionicons from '@expo/vector-icons/Ionicons';
import { formatLocalDate, formatRangeForDay, type LocalDate } from '@myvedicstar/date-time';
import { buildBestGoodTimes } from '@myvedicstar/domain-models';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Button, Notice } from '../../shared/components';
import { errorMessageKey } from '../../shared/errors';
import { useTranslation } from '../../shared/i18n';
import { STATUS_ICON, statusToneColors } from '../../shared/statusTone';
import { useTheme, weight } from '../../shared/theme';
import { useNow } from '../today/usePanchangToday';
import { useBestGoodTimes } from './useGoodTimes';

/** Reasons shown per option; the day view has the full list. */
const REASONS_SHOWN = 2;

/**
 * "Next best times" (mobile), same as web: the backend's best upcoming Good Times for the activity, one per day, best
 * first. Only Good Times are listed; when none qualifies, the backend's message is shown.
 */
export function BestGoodTimes({
  activity,
  otherText,
  onSelectDay,
}: Readonly<{ activity: string; otherText: string | undefined; onSelectDay: (date: LocalDate) => void }>) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const theme = useTheme();
  const awaitingDescription = activity === 'other' && !otherText?.trim();
  const query = useBestGoodTimes(awaitingDescription ? null : { activity, otherText });
  const response = query.data;
  const items = useMemo(
    () => buildBestGoodTimes(response).filter((item) => Date.parse(item.segment.end) > now),
    [response, now],
  );

  let body;
  if (awaitingDescription) {
    body = <AppText variant="secondary">{t('goodTime.bestOtherRequired')}</AppText>;
  } else if (query.isError) {
    body = (
      <View style={styles.gap}>
        <Notice tone="error">{t(errorMessageKey(query.error))}</Notice>
        <Button variant="secondary" label={t('states.retry')} onPress={() => void query.refetch()} />
      </View>
    );
  } else if (!response) {
    body = <ActivityIndicator accessibilityLabel={t('goodTime.bestLoading')} />;
  } else if (items.length === 0) {
    body = <Notice>{response.noGoodTimeMessage || t('goodTime.noGoodTime')}</Notice>;
  } else {
    const timeZone = response.location.timeZone;
    body = (
      <View style={styles.gap}>
        <AppText variant="secondary">
          {t('goodTime.bestSubtitle', {
            activity: response.activity.name,
            from: formatLocalDate(response.searchedFrom, locale),
            through: formatLocalDate(response.searchedThrough, locale),
          })}
        </AppText>
        {items.map((item) => {
          const colors = statusToneColors(theme, item.tone);
          const date = formatLocalDate(item.date, locale);
          const range = formatRangeForDay(
            item.segment.start,
            item.segment.end,
            { timeZone, locale },
            item.date,
            t('summary.nextDay'),
          );
          const reasons = item.supports.slice(0, REASONS_SHOWN).map((reason) => `✓ ${reason.label}`);
          return (
            <View
              key={`${item.date}-${item.segment.id}`}
              style={[styles.option, { borderLeftColor: colors.fg, backgroundColor: theme.colors.surface }]}
            >
              <View
                accessible
                accessibilityLabel={[
                  t('goodTime.bestRank', { rank: item.rank }),
                  date,
                  range,
                  item.segment.status.name,
                  ...reasons,
                ].join('. ')}
                style={styles.gapSmall}
              >
                <View style={styles.row}>
                  <View style={[styles.rank, { backgroundColor: colors.bg }]}>
                    <AppText style={{ color: colors.fg, fontWeight: weight(theme.fontWeight.bold) }}>
                      {item.rank}
                    </AppText>
                  </View>
                  <AppText variant="secondary">{date}</AppText>
                </View>
                <AppText style={{ fontWeight: weight(theme.fontWeight.bold) }}>{range}</AppText>
                <View style={styles.row}>
                  <Ionicons name={STATUS_ICON[item.tone]} size={16} color={colors.fg} />
                  <AppText style={{ color: colors.fg, fontWeight: weight(theme.fontWeight.bold) }}>
                    {item.segment.status.name}
                  </AppText>
                </View>
                {reasons.map((reason) => (
                  <AppText key={reason} variant="secondary">
                    {reason}
                  </AppText>
                ))}
              </View>
              <Button
                variant="secondary"
                label={t('goodTime.bestViewDay')}
                accessibilityLabel={t('goodTime.bestViewDayFor', { date })}
                onPress={() => onSelectDay(item.date)}
              />
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.tile,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated },
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        <Ionicons name="sparkles-outline" size={20} color={theme.colors.primary} />
        <AppText variant="heading">{t('goodTime.bestTitle')}</AppText>
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { gap: 12, padding: 14, borderWidth: 1, borderRadius: 12 },
  gap: { gap: 10 },
  gapSmall: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  option: { gap: 8, padding: 12, borderLeftWidth: 6, borderRadius: 10 },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
