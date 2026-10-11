import type { Festival, Glossary } from '@myvedicstar/contracts';
import { type LocalDate, todayIn } from '@myvedicstar/date-time';
import {
  addMonths,
  buildDayDashboardForDay,
  type CalendarDay,
  type DayDashboard,
  formatYearMonth,
  parseYearMonth,
  type YearMonth,
  yearMonthOf,
} from '@myvedicstar/domain-models';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { EmptyState, ErrorState, Skeleton } from '../../shared/components/states';
import { useNow } from '../../shared/hooks/useNow';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import { DayTimeline, PanchangPanel, PeriodList } from '../dashboard';
import { FestivalChips, type FestivalsByDate, useFestivalsByDate } from '../festivals';
import { useLocationState } from '../location';
import { useDayHeadline } from '../today/useDayHeadline';
import styles from './CalendarPage.module.css';
import { useCalendarMonth } from './useCalendarMonth';

/**
 * Month calendar (myvedicstar-default theme): each day shows its Tithi at sunrise, the day's rating and observances
 * (Ekadashi, Purnima, Amavasya); selecting a day shows its Panchang, auspicious times and times to avoid. The month and
 * selected day live in the URL (`?month=2026-10&day=2026-10-15`), so they survive reloads and can be shared.
 */
export function CalendarPage() {
  const { t, locale } = useTranslation();
  const { location, openDialog } = useLocationState();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useNow();

  const today = todayIn(location?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, now);
  const shown: YearMonth = parseYearMonth(searchParams.get('month')) ?? yearMonthOf(today);
  const { query, calendar, glossary } = useCalendarMonth(shown);
  const festivals = useFestivalsByDate();

  const requestedDay = searchParams.get('day');
  const selected =
    calendar.days.find((day) => day.date === requestedDay) ??
    calendar.days.find((day) => day.date === today) ??
    calendar.days[0];

  // The selected day's view model, shared by its timeline (under the calendar) and its details panel.
  const selectedPanchang = selected?.panchang;
  const timeZone = location?.timeZone;
  const selectedDashboard = useMemo(
    () =>
      selectedPanchang && timeZone ? buildDayDashboardForDay(selectedPanchang, timeZone, now) : undefined,
    [selectedPanchang, timeZone, now],
  );
  const format = useFormatters();

  const go = (yearMonth: YearMonth, day?: LocalDate) =>
    setSearchParams({ month: formatYearMonth(yearMonth), ...(day ? { day } : {}) });

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        Date.UTC(shown.year, shown.month - 1, 1),
      ),
    [locale, shown.year, shown.month],
  );

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <section className={styles.card} aria-labelledby="calendar-title">
          <div className={styles.toolbar}>
            <h1 id="calendar-title" className={styles.title}>
              {monthTitle}
            </h1>
            <div className={styles.toolbarActions}>
              <Button
                variant="secondary"
                onClick={() => go(addMonths(shown, -1))}
                aria-label={t('calendar.previousMonth')}
              >
                <span aria-hidden="true">‹</span>
              </Button>
              <Button variant="secondary" onClick={() => go(yearMonthOf(today), today)}>
                {t('calendar.today')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => go(addMonths(shown, 1))}
                aria-label={t('calendar.nextMonth')}
              >
                <span aria-hidden="true">›</span>
              </Button>
            </div>
          </div>

          {!location ? (
            <EmptyState
              title={t('summary.chooseLocationTitle')}
              body={t('summary.chooseLocationBody')}
              action={
                <Button onClick={openDialog}>
                  <Icon name="search" />
                  {t('location.choose')}
                </Button>
              }
            />
          ) : query.isError ? (
            <div className={styles.state}>
              <p className={styles.stateTitle}>{t('calendar.errorTitle')}</p>
              <ErrorState
                error={query.error}
                onRetry={() => void query.refetch()}
                retrying={query.isFetching}
              />
            </div>
          ) : (
            <MonthGrid
              weeks={calendar.weeks}
              monthTitle={monthTitle}
              selected={selected?.date}
              loading={query.isPending}
              festivals={festivals}
              onSelect={(day) => go(shown, day)}
            />
          )}

          <Legend />
        </section>

        {selected && selectedDashboard && location && !query.isError && (
          <DayTimeline
            timeline={selectedDashboard.timeline}
            timeZone={location.timeZone}
            date={selected.date}
            locationLabel={location.label}
            title={t('calendar.timelineTitle', { date: format.date(selected.date) })}
          />
        )}
      </div>

      {location && !query.isError && (
        <aside className={styles.side} aria-live="polite">
          {query.isPending || !selected ? (
            <div className={styles.panel} role="status">
              <span className="visually-hidden">{t('calendar.loadingMonth')}</span>
              <div className={styles.panelBody}>
                <Skeleton height="1.5rem" width="60%" />
                <Skeleton height="4rem" />
                <Skeleton height="10rem" />
              </div>
            </div>
          ) : (
            <SelectedDay
              day={selected}
              festivals={festivals.festivalsOn(selected.date)}
              dashboard={selectedDashboard}
              glossary={glossary}
              timeZone={location.timeZone}
            />
          )}
        </aside>
      )}
    </div>
  );
}

function MonthGrid({
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
                {day.tithi && <span className={styles.tithi}>{day.tithi.name}</span>}
                {first && (
                  <span className={styles.tag} data-category={first.category}>
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

function Legend() {
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

/** The selected day's status, auspicious times, times to avoid and Panchang (limbs at sunrise), in that order. */
function SelectedDay({
  day,
  festivals,
  dashboard,
  glossary,
  timeZone,
}: Readonly<{
  day: CalendarDay;
  festivals: readonly Festival[];
  dashboard: DayDashboard | undefined;
  glossary: Glossary | undefined;
  timeZone: string;
}>) {
  const { t } = useTranslation();
  const format = useFormatters();

  return (
    <section className={styles.selected} aria-labelledby="selected-day-title">
      <div className={styles.selectedHead}>
        <h2 id="selected-day-title" className={styles.selectedTitle}>
          {t('calendar.selectedTitle', { date: format.date(day.date) })}
        </h2>
        {dashboard && <DayStatus summary={dashboard.summary} />}
        {festivals.length > 0 && (
          <div className={styles.dayFestivals}>
            <p className={styles.dayFestivalsLabel}>{t('festivals.onThisDay')}</p>
            <FestivalChips festivals={festivals} label={t('festivals.onThisDay')} />
          </div>
        )}
      </div>
      {!dashboard ? (
        <p className={styles.noData}>{t('calendar.noData')}</p>
      ) : (
        <>
          <PeriodList
            id="calendar-auspicious"
            tone="favorable"
            title={t('dashboard.auspiciousTitle')}
            subtitle={t('dashboard.auspiciousSubtitle')}
            items={dashboard.auspicious}
            glossary={glossary}
            timeZone={timeZone}
            date={day.date}
          />
          <PeriodList
            id="calendar-avoid"
            tone="caution"
            title={t('dashboard.avoidTitle')}
            subtitle={t('dashboard.avoidSubtitle')}
            items={dashboard.avoid}
            glossary={glossary}
            timeZone={timeZone}
            date={day.date}
          />
          {glossary !== undefined && (
            <PanchangPanel
              dashboard={dashboard}
              glossary={glossary}
              timeZone={timeZone}
              title={t('calendar.panchangTitle')}
            />
          )}
        </>
      )}
    </section>
  );
}

/** The selected day's status: the backend General day status headline, with the day-factor summary below it. */
function DayStatus({ summary }: Readonly<{ summary: DayDashboard['summary'] }>) {
  const headline = useDayHeadline(summary);
  return (
    <div className={styles.status} data-tone={summary.tone} data-status-tone={summary.tone}>
      <p className={styles.statusHeadline}>{headline}</p>
      <p className={styles.statusBody}>{summary.description}</p>
    </div>
  );
}
