import type { Festival, Glossary } from '@myvedicstar/contracts';
import { addDays, type LocalDate, todayIn } from '@myvedicstar/date-time';
import {
  addMonths,
  buildDayDashboardForDay,
  buildDaySummaryForDay,
  type CalendarDay,
  type DayDashboard,
  formatYearMonth,
  parseYearMonth,
  type YearMonth,
  yearMonthOf,
} from '@myvedicstar/domain-models';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';

import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { EmptyState, ErrorState, Skeleton } from '../../shared/components/states';
import { useNow } from '../../shared/hooks/useNow';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import {
  DayBanner,
  DayTimeline,
  MobileDayDetails,
  PanchangPanel,
  PeriodList,
  RatingFactors,
} from '../dashboard';
import { FestivalChips, useFestivalsByDate } from '../festivals';
import { useGoodTimes } from '../good-time';
import { useLocationState } from '../location';
import { SelectedDaySummaryCard } from '../today';
import styles from './CalendarPage.module.css';
import { Legend, MonthGrid } from './MonthCalendar';
import { useCalendarMonth } from './useCalendarMonth';

function subscribeWidth(listener: () => void) {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

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
  const [fullCalendar, setFullCalendar] = useState(false);

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
    <div
      className={`${styles.layout} ${fullCalendar || !location || query.isError ? styles.monthMode : styles.dayMode}`}
    >
      <div className={styles.mobileDateNavigation}>
        <div className={styles.dayToolbar}>
          <Button
            variant="secondary"
            aria-label={t('calendar.previousDay')}
            onClick={() => {
              const date = addDays(selected?.date ?? today, -1);
              go(yearMonthOf(date), date);
            }}
          >
            ‹
          </Button>
          <div>
            <h1 id="mobile-calendar-date" tabIndex={-1}>
              {format.date(selected?.date ?? today)}
            </h1>
            <p>{t('calendar.selectedDate')}</p>
          </div>
          <Button
            variant="secondary"
            aria-label={t('calendar.nextDay')}
            onClick={() => {
              const date = addDays(selected?.date ?? today, 1);
              go(yearMonthOf(date), date);
            }}
          >
            ›
          </Button>
        </div>
        <Button variant="secondary" onClick={() => setFullCalendar(true)}>
          <Icon name="calendar" />
          {t('calendar.backToCalendar')}
        </Button>
      </div>
      {selectedDashboard && location && !query.isError && (
        <div className={styles.banner}>
          <DayBanner summary={selectedDashboard.summary} location={location} />
        </div>
      )}
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
              onSelect={(day) => {
                go(shown, day);
                setFullCalendar(false);
                if (window.innerWidth < 1024)
                  requestAnimationFrame(() => {
                    document.getElementById('mobile-calendar-date')?.focus({ preventScroll: true });
                    window.scrollTo({ top: 0 });
                  });
              }}
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
          />
        )}
      </div>
      {selectedDashboard && location && !query.isError && (
        <SelectedDayDetails dashboard={selectedDashboard} glossary={glossary} timeZone={location.timeZone} />
      )}
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
  const { location } = useLocationState();
  const now = useNow();
  const { query: goodTimes } = useGoodTimes(
    dashboard?.summary.isToday ? { activity: 'general', date: day.date } : null,
  );
  const summary = day.panchang
    ? buildDaySummaryForDay(day.panchang, timeZone, now, goodTimes.data)
    : dashboard?.summary;
  const mobile = useSyncExternalStore(
    subscribeWidth,
    () => window.innerWidth < 1024,
    () => false,
  );

  return (
    <section className={styles.selected} aria-labelledby="selected-day-title">
      <div className={styles.selectedHead}>
        <h2 id="selected-day-title" className={styles.selectedTitle}>
          {t('calendar.selectedTitle', { date: format.date(day.date) })}
        </h2>
        {summary && location && (
          <SelectedDaySummaryCard
            summary={summary}
            location={location}
            glossary={glossary}
            mobile={mobile}
            goodTimeLoading={summary.isToday && goodTimes.isPending}
          />
        )}
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
            title={t('dashboard.auspiciousTitle', { day: format.day(day.date) })}
            subtitle={t('dashboard.auspiciousSubtitle')}
            items={dashboard.auspicious}
            glossary={glossary}
            timeZone={timeZone}
            date={day.date}
          />
        </>
      )}
    </section>
  );
}

/** The selected day's overall guidance rating, with its matching guidance summary. */

function SelectedDayDetails({
  dashboard,
  glossary,
  timeZone,
}: {
  dashboard: DayDashboard;
  glossary: Glossary | undefined;
  timeZone: string;
}) {
  const { t } = useTranslation();
  const format = useFormatters();
  const day = { date: dashboard.summary.date };
  const mobile = useSyncExternalStore(
    subscribeWidth,
    () => window.innerWidth < 1024,
    () => false,
  );
  return (
    <div className={styles.dayDetails}>
      {mobile ? (
        <MobileDayDetails dashboard={dashboard} glossary={glossary} timeZone={timeZone} />
      ) : (
        <>
          {glossary !== undefined && (
            <PanchangPanel dashboard={dashboard} glossary={glossary} timeZone={timeZone} />
          )}
          <PeriodList
            id="calendar-avoid"
            tone="caution"
            title={t('dashboard.avoidTitle', { day: format.day(day.date) })}
            subtitle={t('dashboard.avoidSubtitle')}
            items={dashboard.avoid}
            glossary={glossary}
            timeZone={timeZone}
            date={day.date}
          />
          <RatingFactors ratingName={dashboard.ratingName} factors={dashboard.factors} date={day.date} />
        </>
      )}
    </div>
  );
}
