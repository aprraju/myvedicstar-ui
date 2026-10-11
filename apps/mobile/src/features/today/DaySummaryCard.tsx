import Ionicons from '@expo/vector-icons/Ionicons';
import type { Glossary, TimePeriod } from '@myvedicstar/contracts';
import { formatLocalDate, formatRangeForDay, formatTime } from '@myvedicstar/date-time';
import type { DaySummary, DayTone, WindowStatus } from '@myvedicstar/domain-models';
import { useCacheOnline } from '@myvedicstar/query-cache';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Button, type IconName, Notice } from '../../shared/components';
import { errorMessageKey } from '../../shared/errors';
import { useTranslation } from '../../shared/i18n';
import { STATUS_ICON, statusToneColors } from '../../shared/statusTone';
import { useTheme, weight } from '../../shared/theme';
import { useLocationState } from '../location/LocationProvider';
import { LocationPermissionMessage } from '../location/LocationSheet';
import { useDaySummary } from './usePanchangToday';

const TONE_ICON: Record<DayTone, IconName> = STATUS_ICON;

/** "How is today?" card — the same answers as web: the day, good time now, next caution period. */
export function DaySummaryCard({ onFindGoodTime }: { onFindGoodTime: () => void }) {
  const { t, locale } = useTranslation();
  const online = useCacheOnline();
  const theme = useTheme();
  const { query, location, summary, glossary } = useDaySummary();
  const { ready, detecting } = useLocationState();

  let body;
  if (!ready || (!location && detecting)) {
    body = <Loading label={detecting ? t('location.locating') : t('states.loading')} />;
  } else if (!location) {
    body = <ChooseLocation />;
  } else if (query.isPending) {
    body = <Loading label={t(online ? 'states.loading' : 'cache.unavailable')} />;
  } else if ((query.isError && !query.data) || !summary) {
    body = (
      <View style={styles.gap}>
        <AppText variant="heading">{t('summary.errorTitle')}</AppText>
        <Notice tone="error">{t(errorMessageKey(query.error))}</Notice>
        <Button
          variant="secondary"
          label={t('states.retry')}
          loading={query.isFetching}
          onPress={() => void query.refetch()}
        />
      </View>
    );
  } else {
    body = (
      <Content
        summary={summary}
        locationLabel={location.label}
        glossary={glossary}
        onFindGoodTime={onFindGoodTime}
      />
    );
  }

  return (
    <View
      accessibilityLabel={t('summary.label')}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
        },
      ]}
    >
      {body}
      {!online && query.data && location && (
        <Notice>
          {t('cache.offline', {
            time: formatTime(query.dataUpdatedAt, { timeZone: location.timeZone, locale }),
          })}
        </Notice>
      )}
      {query.isError && query.data && <Notice tone="error">{t(errorMessageKey(query.error))}</Notice>}
    </View>
  );
}

function Content({
  summary,
  locationLabel,
  glossary,
  onFindGoodTime,
}: {
  summary: DaySummary;
  locationLabel: string;
  glossary: Glossary | undefined;
  onFindGoodTime: () => void;
}) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const tone = toneColors(theme, summary.tone);

  return (
    <View style={styles.gap}>
      <View>
        <AppText variant="title">{formatLocalDate(summary.date, locale)}</AppText>
        <AppText variant="secondary">
          {[summary.paksha && t(`summary.paksha.${summary.paksha}`), summary.tithi?.current.name]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </View>

      <View style={[styles.tone, { backgroundColor: tone.bg }]}>
        <Ionicons name={TONE_ICON[summary.tone]} size={20} color={tone.fg} />
        <AppText style={{ color: tone.fg, fontWeight: weight(theme.fontWeight.bold) }}>
          {summary.dayStatus ? t(`summary.dayHeadline.${summary.tone}`) : summary.headline}
        </AppText>
      </View>
      <AppText variant="secondary">{summary.description}</AppText>

      <GoodTime summary={summary} />
      <Caution status={summary.caution} summary={summary} glossary={glossary} />

      <Button icon="time-outline" label={t('home.findGoodTime')} onPress={onFindGoodTime} />
      <AppText variant="secondary">{t('summary.localTimeNote', { location: locationLabel })}</AppText>
    </View>
  );
}

/**
 * Good time now / next from the backend's General evaluation: only segments marked `isGoodTime`. Nothing is shown as
 * a Good Time while it loads; a day without one shows the backend's message.
 */
function GoodTime({ summary }: { summary: DaySummary }) {
  const { t, locale } = useTranslation();
  const options = { timeZone: summary.timeZone, locale };
  const status = summary.goodTime;
  const value =
    status.status === 'unavailable'
      ? t('summary.goodTimeChecking')
      : status.status === 'none'
        ? (summary.noGoodTimeMessage ?? t('summary.noGoodTime'))
        : status.status === 'now'
          ? t('summary.goodTimeUntil', { time: formatTime(status.window.end, options) })
          : formatRangeForDay(
              status.window.start,
              status.window.end,
              options,
              summary.date,
              t('summary.nextDay'),
            );
  return (
    <Fact
      kind={status.status === 'now' || status.status === 'next' ? 'favorable' : 'caution'}
      label={status.status === 'now' ? t('summary.goodTimeNow') : t('summary.nextGoodTime')}
      value={value}
    />
  );
}

function Caution({
  status,
  summary,
  glossary,
}: {
  status: WindowStatus<TimePeriod>;
  summary: DaySummary;
  glossary: Glossary | undefined;
}) {
  const { t, locale } = useTranslation();
  if (status.status === 'none') {
    return <Fact kind="caution" label={t('summary.nextCaution')} value={t('summary.noCaution')} />;
  }
  const period = status.window;
  const range = formatRangeForDay(
    period.start,
    period.end,
    { timeZone: summary.timeZone, locale },
    summary.date,
    t('summary.nextDay'),
  );
  return (
    <Fact
      kind="caution"
      label={status.status === 'now' ? t('summary.cautionNow') : t('summary.nextCaution')}
      value={`${period.name} ${range}`}
      note={glossary?.periods?.[period.kind]?.message ?? undefined}
    />
  );
}

function Fact({
  kind,
  label,
  value,
  note,
}: {
  kind: 'favorable' | 'warning' | 'caution';
  label: string;
  value: string;
  note?: string | undefined;
}) {
  const theme = useTheme();
  const fg = theme.colors[kind];
  const bg = theme.colors[`${kind}Surface`];
  return (
    <View
      accessible
      accessibilityLabel={[label, value, note].filter(Boolean).join('. ')}
      style={[styles.fact, { backgroundColor: bg, borderLeftColor: fg, borderRadius: theme.radius.md }]}
    >
      <View style={styles.row}>
        <Ionicons name={kind === 'favorable' ? 'checkmark' : 'alert-circle-outline'} size={18} color={fg} />
        <AppText variant="label" style={{ color: fg }}>
          {label.toUpperCase()}
        </AppText>
      </View>
      <AppText variant="heading">{value}</AppText>
      {note && <AppText variant="secondary">{note}</AppText>}
    </View>
  );
}

function ChooseLocation() {
  const { t } = useTranslation();
  const { openSheet, detectCurrentLocation, detecting, detectError } = useLocationState();
  return (
    <View style={styles.gap}>
      <AppText variant="heading">{t('summary.chooseLocationTitle')}</AppText>
      <AppText variant="secondary">{t('summary.chooseLocationBody')}</AppText>
      {detectError && <LocationPermissionMessage error={detectError} />}
      <Button
        icon="locate-outline"
        label={t('location.useCurrent')}
        loading={detecting}
        onPress={() => void detectCurrentLocation()}
      />
      <Button variant="secondary" icon="search" label={t('location.choose')} onPress={openSheet} />
    </View>
  );
}

function Loading({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.loading}>
      <ActivityIndicator color={theme.colors.primary} />
      <AppText variant="secondary">{label}</AppText>
    </View>
  );
}

const toneColors = statusToneColors;

const styles = StyleSheet.create({
  card: { borderWidth: 1, gap: 16 },
  gap: { gap: 14 },
  tone: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  fact: { gap: 4, padding: 14, borderLeftWidth: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 24 },
});
