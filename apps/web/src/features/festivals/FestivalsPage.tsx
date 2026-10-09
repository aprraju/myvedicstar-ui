import type { Festival } from '@myvedicstar/contracts';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { EmptyState, ErrorState, Skeleton } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import { useLocationState } from '../location';
import styles from './FestivalsPage.module.css';
import { useUpcomingFestivals } from './useUpcomingFestivals';

const RANGES = [30, 60, 90] as const;
const FILTERS = ['all', 'festival', 'observance'] as const;
type Filter = (typeof FILTERS)[number];

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

  const update = (next: { days?: number; show?: Filter }) => {
    const params = new URLSearchParams(searchParams);
    if (next.days !== undefined) params.set('days', String(next.days));
    if (next.show !== undefined) params.set('show', next.show);
    setSearchParams(params, { replace: true });
  };

  const festivals = useMemo(
    () => (query.data?.festivals ?? []).filter((f) => show === 'all' || f.category === show),
    [query.data, show],
  );
  const months = useMemo(() => groupByMonth(festivals, locale), [festivals, locale]);

  return (
    <section className={styles.page} aria-labelledby="festivals-title">
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
              <ul className={styles.list}>
                {items.map((festival) => (
                  <FestivalCard
                    key={`${festival.key}-${festival.date}`}
                    festival={festival}
                    timeZone={location.timeZone}
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

function FestivalCard({ festival, timeZone }: Readonly<{ festival: Festival; timeZone: string }>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const { timing } = festival;
  const when =
    festival.daysFromToday === 0
      ? t('festivals.today')
      : festival.daysFromToday === 1
        ? t('festivals.tomorrow')
        : t('festivals.inDays', { count: festival.daysFromToday });
  // Days offset from the anchor day (Holi, Bhogi, Kanuma) have no observance window of their own.
  const observance =
    timing.observanceStart === null || timing.observanceEnd === null
      ? undefined
      : timing.observanceStart === timing.observanceEnd
        ? format.dateTime(timing.observanceStart, timeZone)
        : `${format.dateTime(timing.observanceStart, timeZone)} – ${format.dateTime(timing.observanceEnd, timeZone)}`;
  const basis =
    timing.start === timing.end
      ? t('festivals.sankranti', { time: format.dateTime(timing.start, timeZone) })
      : t('festivals.basisWindow', {
          basis: timing.basis,
          start: format.dateTime(timing.start, timeZone),
          end: format.dateTime(timing.end, timeZone),
        });

  return (
    <li className={styles.card} data-category={festival.category}>
      <span className={styles.icon} aria-hidden="true">
        {festival.icon ?? '•'}
      </span>
      <div className={styles.body}>
        <div className={styles.cardHead}>
          <h3 className={styles.name}>{festival.name}</h3>
          <span className={styles.badge} data-category={festival.category}>
            {festival.categoryName}
          </span>
        </div>
        <p className={styles.date}>
          {format.date(festival.date)}
          <span className={styles.when} data-soon={festival.daysFromToday <= 1 || undefined}>
            {when}
          </span>
        </p>
        {festival.description && <p className={styles.description}>{festival.description}</p>}
        {observance && (
          <p className={styles.timing}>
            <Icon name="clock" size={14} />
            {t('festivals.observedAt', { moment: timing.observanceTimeName, time: observance })}
          </p>
        )}
        <p className={styles.timing}>
          <Icon name="moon" size={14} />
          {basis}
        </p>
      </div>
    </li>
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
