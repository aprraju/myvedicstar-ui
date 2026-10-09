import Ionicons from '@expo/vector-icons/Ionicons';
import { formatLocalDate, formatRangeForDay, type LocalDate } from '@myvedicstar/date-time';
import {
  addMonths,
  buildGoodTimeMonth,
  formatYearMonth,
  type StatusTone,
  type YearMonth,
} from '@myvedicstar/domain-models';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Notice } from '../../shared/components';
import { errorMessageKey } from '../../shared/errors';
import { useTranslation } from '../../shared/i18n';
import { STATUS_ICON, statusToneColors } from '../../shared/statusTone';
import { useTheme, weight } from '../../shared/theme';
import { useGoodTimeMonth } from './useGoodTimes';

const TONES: readonly StatusTone[] = ['highly-favorable', 'favorable', 'mixed', 'caution', 'avoid'];

/**
 * Month view (mobile), same as web: the backend's status of every day for the activity, with the best Good Time where
 * there is one. Tapping a day opens it in the day view.
 */
export function GoodTimeMonth({
  yearMonth,
  thisMonth,
  activity,
  otherText,
  onMonthChange,
  onSelectDay,
}: Readonly<{
  yearMonth: YearMonth;
  thisMonth: YearMonth | undefined;
  activity: string;
  otherText: string | undefined;
  onMonthChange: (yearMonth: YearMonth) => void;
  onSelectDay: (date: LocalDate) => void;
}>) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const awaitingDescription = activity === 'other' && !otherText?.trim();
  const query = useGoodTimeMonth(awaitingDescription ? null : { yearMonth, activity, otherText });
  // A placeholder from another month must not be laid out as this one.
  const response = query.data?.days[0]?.date.startsWith(formatYearMonth(yearMonth)) ? query.data : undefined;
  const month = useMemo(() => buildGoodTimeMonth(response, yearMonth), [response, yearMonth]);
  const monthTitle = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(yearMonth.year, yearMonth.month - 1, 1));
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(
          Date.UTC(2026, 0, 4 + i),
        ),
      ),
    [locale],
  );
  const isThisMonth = thisMonth?.year === yearMonth.year && thisMonth.month === yearMonth.month;
  const timeZone = response?.location.timeZone;

  return (
    <View style={styles.gap}>
      <View style={styles.row}>
        <Button
          variant="ghost"
          icon="chevron-back"
          label=""
          accessibilityLabel={t('goodTime.previousMonth')}
          onPress={() => onMonthChange(addMonths(yearMonth, -1))}
        />
        <AppText variant="heading" style={styles.flex}>
          {monthTitle}
        </AppText>
        <Button
          variant="ghost"
          icon="chevron-forward"
          label=""
          accessibilityLabel={t('goodTime.nextMonth')}
          onPress={() => onMonthChange(addMonths(yearMonth, 1))}
        />
        {thisMonth && !isThisMonth && (
          <Button
            variant="secondary"
            label={t('goodTime.thisMonth')}
            onPress={() => onMonthChange(thisMonth)}
          />
        )}
      </View>

      {awaitingDescription ? (
        <AppText variant="secondary">{t('goodTime.otherRequired')}</AppText>
      ) : query.isError ? (
        <View style={styles.gap}>
          <Notice tone="error">{t(errorMessageKey(query.error))}</Notice>
          <Button variant="secondary" label={t('states.retry')} onPress={() => void query.refetch()} />
        </View>
      ) : !response ? (
        <ActivityIndicator accessibilityLabel={t('goodTime.monthLoading')} />
      ) : (
        <View style={styles.gap}>
          <AppText variant="secondary">
            {t('goodTime.monthHint', { activity: response.activity.name })}
          </AppText>
          <View accessibilityLabel={t('goodTime.monthGrid', { month: monthTitle })} style={styles.grid}>
            {weekdays.map((name, i) => (
              <View key={`w${i}`} style={styles.cell} importantForAccessibility="no-hide-descendants">
                <AppText variant="label" style={styles.center}>
                  {name}
                </AppText>
              </View>
            ))}
            {month.weeks.flat().map((day, index) => {
              if (!day) return <View key={`pad-${index}`} style={styles.cell} />;
              const colors = day.tone ? statusToneColors(theme, day.tone) : undefined;
              const best = day.summary?.bestGoodTime;
              const label = [
                formatLocalDate(day.date, locale),
                day.summary?.status.name,
                best && timeZone
                  ? t('goodTime.monthBest', {
                      time: formatRangeForDay(
                        best.start,
                        best.end,
                        { timeZone, locale },
                        day.date,
                        t('summary.nextDay'),
                      ),
                    })
                  : day.summary
                    ? t('goodTime.monthNoGoodTime')
                    : undefined,
                day.isToday ? t('calendar.todayMarker') : undefined,
              ]
                .filter(Boolean)
                .join(', ');
              return (
                <View key={day.date} style={styles.cell}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    onPress={() => onSelectDay(day.date)}
                    style={({ pressed }) => [
                      styles.day,
                      {
                        backgroundColor: colors?.bg ?? theme.colors.surface,
                        borderColor: day.isToday ? theme.colors.primary : theme.colors.border,
                        borderWidth: day.isToday ? 2 : 1,
                        opacity: pressed ? 0.8 : day.isPast ? 0.6 : 1,
                      },
                    ]}
                  >
                    <AppText style={{ fontWeight: weight(theme.fontWeight.bold) }}>{day.dayOfMonth}</AppText>
                    {day.tone && colors && (
                      <Ionicons name={STATUS_ICON[day.tone]} size={14} color={colors.fg} />
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
          <View style={styles.legend} accessibilityLabel={t('goodTime.statusLegend')}>
            {TONES.map((tone) => {
              const colors = statusToneColors(theme, tone);
              return (
                <View key={tone} style={styles.legendItem}>
                  <Ionicons name={STATUS_ICON[tone]} size={14} color={colors.fg} />
                  <AppText variant="label" style={{ color: colors.fg }}>
                    {t(`summary.tone.${tone}`)}
                  </AppText>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  // Seven equal columns that always fit the screen width (phones and foldables never scroll sideways).
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, padding: 2 },
  center: { textAlign: 'center' },
  day: { minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
