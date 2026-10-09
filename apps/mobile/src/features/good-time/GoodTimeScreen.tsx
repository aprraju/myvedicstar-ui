import Ionicons from '@expo/vector-icons/Ionicons';
import type { MuhurtaActivity } from '@myvedicstar/contracts';
import { addDays, formatLocalDate, formatRangeForDay, type LocalDate, todayIn } from '@myvedicstar/date-time';
import {
  buildGoodTimeView,
  defaultActivityKey,
  type ExplainedSegment,
  type YearMonth,
  yearMonthOf,
} from '@myvedicstar/domain-models';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, type IconName, Notice, TextField } from '../../shared/components';
import { errorMessageKey } from '../../shared/errors';
import { useTranslation } from '../../shared/i18n';
import { STATUS_ICON, statusToneColors } from '../../shared/statusTone';
import { useTheme, weight } from '../../shared/theme';
import { useLocationState } from '../location/LocationProvider';
import { useNow } from '../today/usePanchangToday';
import { BestGoodTimes } from './BestGoodTimes';
import { GoodTimeMonth } from './GoodTimeMonth';
import { useGoodTimes, useMuhurtaActivities } from './useGoodTimes';

const OTHER = 'other';

type PlanningView = 'day' | 'month';

/** Backend icon keys → Ionicons; unknown keys get a generic icon so new activities need no release. */
const ACTIVITY_ICONS: Record<string, IconName> = {
  briefcase: 'briefcase-outline',
  plane: 'airplane-outline',
  'home-key': 'key-outline',
  car: 'car-outline',
  'document-signature': 'document-text-outline',
  book: 'book-outline',
  lamp: 'flame-outline',
  rings: 'heart-outline',
  house: 'home-outline',
  sun: 'sunny-outline',
  more: 'ellipsis-horizontal',
};

/**
 * Find a Good Time (mobile) — the same backend evaluation and rules as web: the backend decides every status and Good
 * Time; this screen only shows them, explains favorable periods it did not recommend, and never promotes a time when
 * none qualifies. Day or month view, plus the "Next best times" tile for the activity.
 */
export function GoodTimeScreen({ initialActivity }: Readonly<{ initialActivity?: string | undefined }>) {
  const { t } = useTranslation();
  const { location } = useLocationState();
  const activities = useMuhurtaActivities();
  const [requested, setRequested] = useState<string | undefined>(initialActivity);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [otherDraft, setOtherDraft] = useState('');
  const [otherText, setOtherText] = useState('');
  const [view, setView] = useState<PlanningView>('day');
  const [month, setMonth] = useState<YearMonth | undefined>(undefined);

  const list = useMemo(() => activities.data?.activities ?? [], [activities.data]);
  const activity = activities.data
    ? defaultActivityKey(list, activities.data.defaultActivity, requested)
    : 'general';
  const activityText = activity === OTHER ? otherText : undefined;
  const { query } = useGoodTimes(
    location && view === 'day' ? { date, activity, otherText: activityText } : null,
  );
  const today = location ? todayIn(location.timeZone) : undefined;
  const shownDate = (view === 'day' ? query.data?.date : undefined) ?? date ?? today;
  const shownMonth = month ?? (shownDate ? yearMonthOf(shownDate) : undefined);

  /** Opens a date in the day view (from the month grid or a best time). */
  const selectDay = (day: LocalDate) => {
    setView('day');
    setMonth(undefined);
    setDate(day === today ? undefined : day);
  };

  return (
    <View style={styles.gap}>
      <AppText variant="title" accessibilityRole="header">
        {t('goodTime.title')}
      </AppText>
      <AppText variant="heading" accessibilityRole="header" nativeID="good-time-question">
        {t('goodTime.question')}
      </AppText>

      {activities.isPending ? (
        <ActivityIndicator accessibilityLabel={t('states.loading')} />
      ) : activities.isError ? (
        <Notice tone="error">{t(errorMessageKey(activities.error))}</Notice>
      ) : (
        <ActivityCards activities={list} selected={activity} onSelect={setRequested} />
      )}

      {activity === OTHER && (
        <View style={styles.gap}>
          <TextField
            label={t('goodTime.otherLabel')}
            hint={t('goodTime.otherHint')}
            value={otherDraft}
            maxLength={80}
            placeholder={t('goodTime.otherPlaceholder')}
            onChangeText={setOtherDraft}
            onSubmitEditing={() => setOtherText(otherDraft.trim())}
            returnKeyType="search"
          />
          <Button label={t('goodTime.otherSubmit')} onPress={() => setOtherText(otherDraft.trim())} />
        </View>
      )}

      <ViewToggle view={view} onChange={setView} />

      {location && <BestGoodTimes activity={activity} otherText={activityText} onSelectDay={selectDay} />}

      {view === 'month' ? (
        shownMonth && (
          <GoodTimeMonth
            yearMonth={shownMonth}
            thisMonth={today ? yearMonthOf(today) : undefined}
            activity={activity}
            otherText={activityText}
            onMonthChange={setMonth}
            onSelectDay={selectDay}
          />
        )
      ) : (
        <DayResults
          shownDate={shownDate}
          today={today}
          awaitingDescription={activity === OTHER && !otherText}
          query={query}
          onDateChange={setDate}
        />
      )}
    </View>
  );
}

/** Day or month: a pair of radio buttons styled as a segmented control. */
function ViewToggle({
  view,
  onChange,
}: Readonly<{ view: PlanningView; onChange: (view: PlanningView) => void }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.gapSmall}>
      <AppText variant="label" nativeID="good-time-view">
        {t('goodTime.view')}
      </AppText>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabelledBy="good-time-view"
        style={[styles.views, { borderColor: theme.colors.borderStrong }]}
      >
        {(['day', 'month'] as const).map((option) => {
          const checked = view === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              accessibilityLabel={t(`goodTime.views.${option}`)}
              onPress={() => onChange(option)}
              style={[
                styles.viewOption,
                { minHeight: theme.touchTarget.minimum },
                { backgroundColor: checked ? theme.colors.primary : theme.colors.surface },
              ]}
            >
              <Ionicons
                name={option === 'day' ? 'sunny-outline' : 'calendar-outline'}
                size={16}
                color={checked ? theme.colors.onPrimary : theme.colors.textPrimary}
              />
              <AppText
                style={{
                  color: checked ? theme.colors.onPrimary : theme.colors.textPrimary,
                  fontWeight: weight(checked ? theme.fontWeight.bold : theme.fontWeight.regular),
                }}
              >
                {t(`goodTime.views.${option}`)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DayResults({
  shownDate,
  today,
  awaitingDescription,
  query,
  onDateChange,
}: Readonly<{
  shownDate: LocalDate | undefined;
  today: LocalDate | undefined;
  awaitingDescription: boolean;
  query: ReturnType<typeof useGoodTimes>['query'];
  onDateChange: (date: LocalDate | undefined) => void;
}>) {
  const { t, locale } = useTranslation();
  const setDate = onDateChange;
  return (
    <View style={styles.gap}>
      {shownDate && (
        <View style={styles.row}>
          <Button
            variant="ghost"
            icon="chevron-back"
            label=""
            accessibilityLabel={t('goodTime.previousDay')}
            onPress={() => setDate(addDays(shownDate, -1))}
          />
          <AppText style={styles.flex}>{formatLocalDate(shownDate, locale)}</AppText>
          <Button
            variant="ghost"
            icon="chevron-forward"
            label=""
            accessibilityLabel={t('goodTime.nextDay')}
            onPress={() => setDate(addDays(shownDate, 1))}
          />
          {today && shownDate !== today && (
            <Button variant="secondary" label={t('goodTime.today')} onPress={() => setDate(undefined)} />
          )}
        </View>
      )}

      {awaitingDescription ? (
        <AppText variant="secondary">{t('goodTime.otherRequired')}</AppText>
      ) : query.isError ? (
        <View style={styles.gap}>
          <AppText variant="heading">{t('goodTime.errorTitle')}</AppText>
          <Notice tone="error">{t(errorMessageKey(query.error))}</Notice>
          <Button
            variant="secondary"
            label={t('states.retry')}
            loading={query.isFetching}
            onPress={() => void query.refetch()}
          />
        </View>
      ) : !query.data ? (
        <ActivityIndicator accessibilityLabel={t('goodTime.loading')} />
      ) : (
        <Results
          response={query.data}
          updating={query.isFetching && query.isPlaceholderData}
          onNextDate={(d) => setDate(addDays(d, 1))}
        />
      )}
    </View>
  );
}

function ActivityCards({
  activities,
  selected,
  onSelect,
}: Readonly<{ activities: readonly MuhurtaActivity[]; selected: string; onSelect: (key: string) => void }>) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabelledBy="good-time-question" style={styles.cards}>
      {activities.map((activity) => {
        const checked = activity.key === selected;
        return (
          <Pressable
            key={activity.key}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            accessibilityLabel={activity.name}
            onPress={() => onSelect(activity.key)}
            style={[
              styles.card,
              {
                borderColor: checked ? theme.colors.primary : theme.colors.border,
                borderWidth: checked ? 2 : 1,
                backgroundColor: checked ? theme.colors.auspiciousSurface : theme.colors.surfaceElevated,
              },
            ]}
          >
            <Ionicons
              name={ACTIVITY_ICONS[activity.icon] ?? 'sparkles-outline'}
              size={26}
              color={theme.colors.primary}
            />
            <AppText style={[styles.cardLabel, checked && { fontWeight: weight(theme.fontWeight.bold) }]}>
              {activity.name}
            </AppText>
            {checked && (
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} style={styles.check} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function Results({
  response,
  updating,
  onNextDate,
}: Readonly<{
  response: NonNullable<ReturnType<typeof useGoodTimes>['query']['data']>;
  updating: boolean;
  onNextDate: (date: string) => void;
}>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow();
  const view = useMemo(() => buildGoodTimeView(response, now), [response, now]);
  const dayColors = statusToneColors(theme, view.dayTone);

  return (
    <View style={styles.gap} accessibilityLiveRegion="polite">
      <View style={[styles.pill, { backgroundColor: dayColors.bg }]}>
        <Ionicons name={STATUS_ICON[view.dayTone]} size={18} color={dayColors.fg} />
        <AppText style={{ color: dayColors.fg }}>
          {t('goodTime.dayStatus')}: {response.dayStatus.name}
        </AppText>
      </View>
      {response.activity.completeness === 'partial' && (
        <AppText variant="secondary">{t('goodTime.partial')}</AppText>
      )}
      {updating && <AppText variant="secondary">{t('goodTime.updating')}</AppText>}
      {response.notices.map((notice) => (
        <Notice key={notice}>{notice}</Notice>
      ))}

      {view.goodTimes.length > 0 ? (
        <View style={styles.gap}>
          <AppText variant="heading" accessibilityRole="header">
            {t('goodTime.recommended', { count: view.goodTimes.length })}
          </AppText>
          {view.goodTimes.map((item) => (
            <SegmentCard
              key={item.segment.id}
              item={item}
              timeZone={response.location.timeZone}
              date={response.date}
            />
          ))}
        </View>
      ) : (
        <View style={styles.gap}>
          <Notice>{view.noGoodTime?.message || t('goodTime.noGoodTime')}</Notice>
          <Button
            variant="secondary"
            label={t('goodTime.chooseAnotherDate')}
            onPress={() => onNextDate(response.date)}
          />
        </View>
      )}

      {view.notRecommended.length > 0 && (
        <View style={styles.gap}>
          <AppText variant="heading" accessibilityRole="header">
            {t('goodTime.whyNot')}
          </AppText>
          <AppText variant="secondary">{t('goodTime.whyNotBody')}</AppText>
          {view.notRecommended.map((item) => (
            <SegmentCard
              key={item.segment.id}
              item={item}
              timeZone={response.location.timeZone}
              date={response.date}
            />
          ))}
        </View>
      )}

      <AppText variant="secondary" style={styles.disclaimer}>
        {response.disclaimer}
      </AppText>
    </View>
  );
}

function SegmentCard({
  item,
  timeZone,
  date,
}: Readonly<{ item: ExplainedSegment; timeZone: string; date: string }>) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const colors = statusToneColors(theme, item.tone);
  const { segment } = item;
  const range = formatRangeForDay(
    segment.start,
    segment.end,
    { timeZone, locale },
    date,
    t('summary.nextDay'),
  );
  const lines = [
    ...item.supports.map((reason) => `✓ ${reason.label}`),
    ...item.clearOf.map((reason) => `✓ ${reason.label}`),
    ...item.conflicts.map(
      (conflict) =>
        `⚠ ${conflict.label}: ${formatRangeForDay(conflict.start, conflict.end, { timeZone, locale }, date, t('summary.nextDay'))}`,
    ),
    ...item.cautions.map((reason) => `⚠ ${reason.label}`),
  ];
  return (
    <View
      accessible
      accessibilityLabel={`${range}. ${segment.headline}. ${lines.join('. ')}`}
      style={[styles.segment, { borderLeftColor: colors.fg, backgroundColor: theme.colors.surface }]}
    >
      <AppText style={{ fontWeight: weight(theme.fontWeight.bold) }}>{range}</AppText>
      <View style={styles.row}>
        <Ionicons name={STATUS_ICON[item.tone]} size={18} color={colors.fg} />
        <AppText style={{ color: colors.fg, fontWeight: weight(theme.fontWeight.bold) }}>
          {segment.headline}
        </AppText>
      </View>
      <AppText variant="secondary">{segment.isGoodTime ? t('goodTime.why') : segment.status.name}</AppText>
      {lines.map((line) => (
        <AppText key={line}>{line}</AppText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  gapSmall: { gap: 6 },
  views: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  viewOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  // Wrapping grid: as many cards per row as fit, so phones and foldables never scroll sideways.
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    flexGrow: 1,
    flexBasis: 100,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 12,
  },
  cardLabel: { textAlign: 'center' },
  check: { position: 'absolute', top: 6, right: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  segment: { gap: 4, padding: 14, borderLeftWidth: 6, borderRadius: 10 },
  disclaimer: { fontSize: 12 },
});
