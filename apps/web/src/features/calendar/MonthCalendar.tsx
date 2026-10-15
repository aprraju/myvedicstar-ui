import type { LocalDate } from '@myvedicstar/date-time';
import { addMonths, type CalendarDay, type YearMonth } from '@myvedicstar/domain-models';
import { useMemo } from 'react';

import { Button } from '../../shared/components/Button';
import { ErrorState } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import { type FestivalsByDate, useFestivalsByDate } from '../festivals';
import styles from './CalendarPage.module.css';
import { useCalendarMonth } from './useCalendarMonth';

/**
 * The Panchang month as a card (title, ‹ Today ›, grid, legend), exactly as on the Panchang calendar, for pages that
 * pick a date from it (Find a Good Time on phones). It reads the same month query, so the two pages share one cache.
 */
export function MonthCalendarCard({
  yearMonth,
  today,
  selected,
  onSelect,
  onMonthChange,
  headingId,
}: Readonly<{
  yearMonth: YearMonth;
  today: LocalDate;
  selected: LocalDate | undefined;
  onSelect: (date: LocalDate) => void;
  onMonthChange: (yearMonth: YearMonth) => void;
  headingId: string;
}>) {
  const { t, locale } = useTranslation();
  const { query, calendar } = useCalendarMonth(yearMonth);
  const festivals = useFestivalsByDate();
  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        Date.UTC(yearMonth.year, yearMonth.month - 1, 1),
      ),
    [locale, yearMonth.year, yearMonth.month],
  );

  return (
    <section className={`${styles.card} ${styles.embeddedCard}`} aria-labelledby={headingId}>
      <div className={styles.toolbar}>
        <h2 id={headingId} className={`${styles.title} ${styles.embeddedTitle}`}>
          {monthTitle}
        </h2>
        <div className={styles.toolbarActions}>
          <Button
            variant="secondary"
            onClick={() => onMonthChange(addMonths(yearMonth, -1))}
            aria-label={t('calendar.previousMonth')}
          >
            <span aria-hidden="true">‹</span>
          </Button>
          <Button variant="secondary" onClick={() => onSelect(today)}>
            {t('calendar.today')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => onMonthChange(addMonths(yearMonth, 1))}
            aria-label={t('calendar.nextMonth')}
          >
            <span aria-hidden="true">›</span>
          </Button>
        </div>
      </div>
      {query.isError ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>{t('calendar.errorTitle')}</p>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        </div>
      ) : (
        <MonthGrid
          weeks={calendar.weeks}
          monthTitle={monthTitle}
          selected={selected}
          loading={query.isPending}
          festivals={festivals}
          onSelect={onSelect}
        />
      )}
      <Legend />
    </section>
  );
}

/**
 * The Panchang month grid and its legend, shared by the Panchang calendar and the phone layout of Find a Good Time
 * (so both show exactly the same calendar). Each day shows its Tithi at sunrise, the day's rating and observances.
 */
export function MonthGrid({
  weeks,
  monthTitle,
  selected,
  loading,
  festivals,
  onSelect,
}: Readonly<{
  weeks: (CalendarDay | null)[][];
  monthTitle: string;
  selected: LocalDate | undefined;
  loading: boolean;
  festivals: FestivalsByDate;
  onSelect: (date: LocalDate) => void;
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

  return (
    <div
      className={styles.grid}
      role="group"
      aria-label={t('calendar.monthGrid', { month: monthTitle })}
      aria-busy={loading || undefined}
    >
      {weekdays.map((name) => (
        <div key={name} className={styles.weekday} aria-hidden="true">
          {name}
        </div>
      ))}
      {weeks.flat().map((day, index) => {
        if (!day) return <div key={`pad-${index}`} className={styles.pad} aria-hidden="true" />;
        // Within the festival data window the backend's festivals are authoritative; outside it (past months, more
        // than 90 days ahead) the Tithi-based observance is shown instead.
        const known = festivals.covers(day.date);
        const dayFestivals = known ? festivals.festivalsOn(day.date) : [];
        const observance = known ? undefined : day.observance;
        const first = dayFestivals[0];
        const firstObservance =
          first?.category === 'observance' &&
          ['ekadashi', 'purnima', 'amavasya'].includes(first.key.toLowerCase())
            ? first.key.toLowerCase()
            : undefined;
        return (
          <button
            key={day.date}
            type="button"
            className={styles.day}
            data-tone={day.tone}
            aria-pressed={day.date === selected}
            aria-current={day.isToday ? 'date' : undefined}
            aria-label={[
              format.date(day.date),
              day.tithi?.name,
              day.ratingName,
              ...dayFestivals.map((festival) => festival.name),
              observance ? t(`calendar.observances.${observance}`) : undefined,
              day.isToday ? t('calendar.todayMarker') : undefined,
            ]
              .filter(Boolean)
              .join(', ')}
            onClick={() => onSelect(day.date)}
          >
            <span className={styles.dayTop}>
              <span className={styles.dayNumber}>{day.dayOfMonth}</span>
              {day.tone && (
                <span className={styles.toneDot} data-tone={day.tone} data-status-tone={day.tone} />
              )}
            </span>
            {loading ? (
              <span className={styles.dayLoading} />
            ) : (
              <>
                {day.tithi && (
                  <>
                    <span className={`${styles.tithi} ${styles.desktopTithi}`}>{day.tithi.name}</span>
                    <span className={`${styles.tithi} ${styles.mobileTithi}`}>
                      {day.tithi.shortName || day.tithi.name.replace(/^(?:Krishna|Shukla)\s+/i, '')}
                    </span>
                  </>
                )}
                {first && (
                  <span
                    className={styles.tag}
                    data-category={first.category}
                    data-observance={firstObservance}
                  >
                    {first.icon && <span aria-hidden="true">{first.icon} </span>}
                    {first.name}
                  </span>
                )}
                {dayFestivals.length > 1 && (
                  <span className={styles.more}>
                    {t('festivals.more', { count: dayFestivals.length - 1 })}
                  </span>
                )}
                {observance && (
                  <span className={styles.tag} data-observance={observance}>
                    {t(`calendar.observances.${observance}`)}
                  </span>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Legend() {
  const { t } = useTranslation();
  return (
    <div className={styles.legend}>
      <ul aria-label={t('calendar.legendRating')}>
        {(['highly-favorable', 'favorable', 'mixed', 'caution', 'avoid'] as const).map((tone) => (
          <li key={tone} data-tone={tone} data-status-tone={tone}>
            {t(`summary.tone.${tone}`)}
          </li>
        ))}
      </ul>
      <ul aria-label={t('calendar.legendObservances')}>
        {(['ekadashi', 'purnima', 'amavasya'] as const).map((observance) => (
          <li key={observance}>
            <span className={styles.tag} data-observance={observance}>
              {t(`calendar.observances.${observance}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
