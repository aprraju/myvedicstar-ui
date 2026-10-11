import type { LocalDate } from '@myvedicstar/date-time';
import {
  addMonths,
  buildGoodTimeMonth,
  type GoodTimeMonthDay,
  type StatusTone,
  type YearMonth,
} from '@myvedicstar/domain-models';
import { useMemo } from 'react';

import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { ErrorState } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import { STATUS_ICON } from './activityIcons';
import styles from './GoodTimeMonth.module.css';
import { useGoodTimeMonth } from './useGoodTimes';

const TONES: readonly StatusTone[] = ['highly-favorable', 'favorable', 'mixed', 'caution', 'avoid'];

/**
 * Month view of Find a Good Time: the backend's status of every day for the selected activity, with the best Good
 * Time where there is one (`/muhurta/day-summaries`). Choosing a day preserves the selected planning view.
 */
export function GoodTimeMonth({
  yearMonth,
  thisMonth,
  selectedDate,
  onMonthChange,
  activity,
  otherText,
  nakshatra,
  onSelectDay,
}: Readonly<{
  yearMonth: YearMonth;
  thisMonth: YearMonth | undefined;
  selectedDate: LocalDate | undefined;
  onMonthChange: (yearMonth: YearMonth) => void;
  activity: string;
  otherText: string | undefined;
  nakshatra?: string | undefined;
  onSelectDay: (date: LocalDate) => void;
}>) {
  const { t, locale } = useTranslation();
  const awaitingDescription = activity === 'other' && !otherText?.trim();
  const query = useGoodTimeMonth(awaitingDescription ? null : { yearMonth, activity, otherText, nakshatra });
  // A placeholder from another month must not be laid out as this one.
  const response =
    query.data &&
    query.data.days[0]?.date.startsWith(`${yearMonth.year}-${String(yearMonth.month).padStart(2, '0')}`)
      ? query.data
      : undefined;
  const month = useMemo(() => buildGoodTimeMonth(response, yearMonth), [response, yearMonth]);

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        Date.UTC(yearMonth.year, yearMonth.month - 1, 1),
      ),
    [locale, yearMonth.year, yearMonth.month],
  );

  const isThisMonth =
    thisMonth !== undefined && thisMonth.year === yearMonth.year && thisMonth.month === yearMonth.month;

  return (
    <section className={styles.month} aria-labelledby="good-time-month-title">
      <div className={styles.toolbar}>
        <h2 id="good-time-month-title" className={styles.title}>
          {monthTitle}
        </h2>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            aria-label={t('goodTime.previousMonth')}
            onClick={() => onMonthChange(addMonths(yearMonth, -1))}
          >
            <span aria-hidden="true">&lsaquo;</span>
          </Button>
          {thisMonth && !isThisMonth && (
            <Button variant="secondary" onClick={() => onMonthChange(thisMonth)}>
              {t('goodTime.thisMonth')}
            </Button>
          )}
          <Button
            variant="secondary"
            aria-label={t('goodTime.nextMonth')}
            onClick={() => onMonthChange(addMonths(yearMonth, 1))}
          >
            <span aria-hidden="true">&rsaquo;</span>
          </Button>
        </div>
      </div>

      {awaitingDescription ? (
        <p className={styles.hint}>{t('goodTime.otherRequired')}</p>
      ) : query.isError ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>{t('goodTime.monthError')}</p>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        </div>
      ) : (
        <>
          <p className={styles.hint}>
            {response
              ? t('goodTime.monthHint', { activity: response.activity.name })
              : t('goodTime.monthLoading')}
          </p>
          <MonthGrid
            weeks={month.weeks}
            selectedDate={selectedDate}
            monthTitle={monthTitle}
            loading={!response}
            timeZone={response?.location.timeZone}
            onSelectDay={onSelectDay}
          />
          <ul className={styles.legend} aria-label={t('goodTime.statusLegend')}>
            {TONES.map((tone) => (
              <li key={tone} data-status-tone={tone}>
                <Icon name={STATUS_ICON[tone]} size={14} />
                {t(`summary.tone.${tone}`)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function MonthGrid({
  weeks,
  selectedDate,
  monthTitle,
  loading,
  timeZone,
  onSelectDay,
}: Readonly<{
  weeks: (GoodTimeMonthDay | null)[][];
  selectedDate: LocalDate | undefined;
  monthTitle: string;
  loading: boolean;
  timeZone: string | undefined;
  onSelectDay: (date: LocalDate) => void;
}>) {
  const { t, locale } = useTranslation();
  const format = useFormatters();
  // 4 January 2026 is a Sunday: localized short weekday names, Sunday first.
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
          Date.UTC(2026, 0, 4 + i),
        ),
      ),
    [locale],
  );

  const describe = (day: GoodTimeMonthDay) => {
    const best = day.summary?.bestGoodTime;
    return [
      format.date(day.date),
      day.summary?.status.name,
      best && timeZone
        ? t('goodTime.monthBest', { time: format.range(best.start, best.end, timeZone, day.date) })
        : day.summary
          ? t('goodTime.monthNoGoodTime')
          : undefined,
      day.isToday ? t('calendar.todayMarker') : undefined,
    ]
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div
      className={styles.grid}
      role="group"
      aria-label={t('goodTime.monthGrid', { month: monthTitle })}
      aria-busy={loading || undefined}
    >
      {weekdays.map((name) => (
        <div key={name} className={styles.weekday} aria-hidden="true">
          {name}
        </div>
      ))}
      {weeks.flat().map((day, index) => {
        if (!day) return <div key={`pad-${index}`} className={styles.pad} aria-hidden="true" />;
        const best = day.summary?.bestGoodTime;
        return (
          <button
            key={day.date}
            type="button"
            className={styles.day}
            data-status-tone={day.tone}
            data-past={day.isPast || undefined}
            aria-pressed={day.date === selectedDate}
            aria-current={day.isToday ? 'date' : undefined}
            aria-label={describe(day)}
            onClick={() => onSelectDay(day.date)}
          >
            <span className={styles.dayTop}>
              <span className={styles.dayNumber}>{day.dayOfMonth}</span>
              {day.tone && <Icon name={STATUS_ICON[day.tone]} size={14} />}
            </span>
            {loading ? (
              <span className={styles.dayLoading} />
            ) : (
              day.summary && (
                <span className={styles.dayDetail}>
                  <span className={styles.dayStatus}>{day.summary.status.name}</span>
                  {best && timeZone ? (
                    <span className={styles.dayBest}>{format.time(best.start, timeZone)}</span>
                  ) : (
                    <span className={styles.dayNone}>{t('goodTime.monthNoGoodTimeShort')}</span>
                  )}
                </span>
              )
            )}
          </button>
        );
      })}
    </div>
  );
}
