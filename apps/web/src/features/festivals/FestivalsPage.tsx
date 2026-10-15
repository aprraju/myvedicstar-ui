import type { Festival } from '@myvedicstar/contracts';
import { buildDaySummary } from '@myvedicstar/domain-models';
import { useMemo, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';

import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { EmptyState, ErrorState, Skeleton } from '../../shared/components/states';
import { useNow } from '../../shared/hooks/useNow';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { DayBanner } from '../dashboard/DayBanner';
import { useLocationState } from '../location';
import { usePanchangToday } from '../today/usePanchangToday';
import styles from './FestivalsPage.module.css';
import { FestivalEventCard, MobileFestivals } from './MobileFestivals';
import { useUpcomingFestivals } from './useUpcomingFestivals';

const RANGES = [30, 60, 90] as const;
const FILTERS = ['all', 'festival', 'observance'] as const;
type Filter = (typeof FILTERS)[number];

/** Phones and small tablets get the mobile layout (same breakpoint as the mobile header and navigation). */
const MOBILE_MAX_WIDTH = 1024;

function subscribeWidth(listener: () => void) {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

/**
 * Upcoming festivals and observances for the selected location and tradition, grouped by month. Each entry shows its
 * date (and how soon), description, the moment the rules observe it (sunrise, Pradosha, Nishita…) and the Tithi or
 * Sankranti it is based on — all from the backend. Range (`?days=`) and category filter (`?show=`) live in the URL.
 */
export function FestivalsPage() {
  const { t, locale } = useTranslation();
  const { location, openDialog } = useLocationState();
  const [searchParams, setSearchParams] = useSearchParams();
  const days = RANGES.find((range) => String(range) === searchParams.get('days')) ?? 30;
  const show: Filter = FILTERS.find((filter) => filter === searchParams.get('show')) ?? 'all';
  const { query } = useUpcomingFestivals(days);

  const mobile = useSyncExternalStore(
    subscribeWidth,
    () => window.innerWidth < MOBILE_MAX_WIDTH,
    () => false,
  );
  const update = (next: { days?: number; show?: Filter }) => {
    const params = new URLSearchParams(searchParams);
    if (next.days !== undefined) params.set('days', String(next.days));
    if (next.show !== undefined) params.set('show', next.show);
    // Phones keep their scroll position when the filter or range changes.
    setSearchParams(params, { replace: true, preventScrollReset: mobile });
  };

  const festivals = useMemo(
    () => (query.data?.festivals ?? []).filter((f) => show === 'all' || f.category === show),
    [query.data, show],
  );
  const months = useMemo(() => groupByMonth(festivals, locale), [festivals, locale]);

  // Wide windows: the Panchang page's day banner for today (imported by file, not through the dashboard / today
  // indexes, which import this feature).
  const { query: todayQuery } = usePanchangToday();
  const now = useNow();
  const todaySummary = useMemo(
    () => (todayQuery.data ? buildDaySummary(todayQuery.data, now) : undefined),
    [todayQuery.data, now],
  );

  if (mobile && location) {
    return (
      <MobileFestivals
        locationLabel={location.label}
        traditionName={query.data?.tradition.name}
        timeZone={location.timeZone}
        filters={FILTERS}
        show={show}
        onShow={(filter) => update({ show: filter })}
        ranges={RANGES}
        days={days}
        onDays={(next) => update({ days: next })}
        festivals={query.data ? festivals : undefined}
        months={months}
        state={
          query.isPending ? (
            <div className={styles.list} role="status" aria-live="polite">
              <span className="visually-hidden">{t('states.loading')}</span>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} height="7rem" />
              ))}
            </div>
          ) : query.isError ? (
            <div className={styles.state}>
              <p className={styles.stateTitle}>{t('festivals.errorTitle')}</p>
              <ErrorState
                error={query.error}
                onRetry={() => void query.refetch()}
                retrying={query.isFetching}
              />
            </div>
          ) : festivals.length === 0 ? (
            <EmptyState title={t('festivals.none')} />
          ) : undefined
        }
      />
    );
  }

  return (
    <section className={styles.page} aria-labelledby="festivals-title">
      {!mobile && todaySummary && location && (
        <div className={styles.pageBanner}>
          <DayBanner summary={todaySummary} location={location} />
        </div>
      )}
      <header className={styles.head}>
        <h1 id="festivals-title" className={styles.title}>
          {t('festivals.title')}
        </h1>
        {query.data && location && (
          <p className={styles.subtitle}>
            {t('festivals.subtitle', { location: location.label, tradition: query.data.tradition.name })}
          </p>
        )}
      </header>

      {location && (
        <div className={styles.controls}>
          <div className={styles.segmented} role="group" aria-label={t('festivals.filter')}>
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className={styles.segment}
                aria-pressed={show === filter}
                onClick={() => update({ show: filter })}
              >
                {t(`festivals.filters.${filter}`)}
              </button>
            ))}
          </div>
          <label className={styles.range}>
            <span>{t('festivals.range')}</span>
            <select value={days} onChange={(event) => update({ days: Number(event.target.value) })}>
              {RANGES.map((range) => (
                <option key={range} value={range}>
                  {t('festivals.rangeOption', { days: range })}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

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
      ) : query.isPending ? (
        <div className={styles.list} role="status" aria-live="polite">
          <span className="visually-hidden">{t('states.loading')}</span>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height="7rem" />
          ))}
        </div>
      ) : query.isError ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>{t('festivals.errorTitle')}</p>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        </div>
      ) : festivals.length === 0 ? (
        <EmptyState title={t('festivals.none')} />
      ) : (
        <>
          <p className={styles.count} aria-live="polite">
            {t('festivals.countLabel', { count: festivals.length })}
          </p>
          {months.map(({ key, title, items }) => (
            <section key={key} className={styles.month} aria-labelledby={`month-${key}`}>
              <h2 id={`month-${key}`} className={styles.monthTitle}>
                {title}
              </h2>
              {/* The same event cards as on phones, three per row on wide windows, then two, then one. */}
              <ul className={styles.eventGrid}>
                {items.map((festival) => (
                  <FestivalEventCard
                    key={`${festival.key}-${festival.date}`}
                    festival={festival}
                    timeZone={location.timeZone}
                    defaultOpen
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </section>
  );
}

function groupByMonth(festivals: readonly Festival[], locale: string) {
  const format = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const groups: { key: string; title: string; items: Festival[] }[] = [];
  for (const festival of festivals) {
    const key = festival.date.slice(0, 7);
    let group = groups.at(-1);
    if (group?.key !== key) {
      const [year, month] = key.split('-').map(Number) as [number, number];
      group = { key, title: format.format(Date.UTC(year, month - 1, 1)), items: [] };
      groups.push(group);
    }
    group.items.push(festival);
  }
  return groups;
}
