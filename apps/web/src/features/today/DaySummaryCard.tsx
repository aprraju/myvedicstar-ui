import type { Glossary, TimePeriod } from '@myvedicstar/contracts';
import type { DaySummary, DayTone, WindowStatus } from '@myvedicstar/domain-models';
import type { SelectedLocation } from '@myvedicstar/domain-models';
import { useId } from 'react';
import { Link } from 'react-router';

import { Button } from '../../shared/components/Button';
import { Icon, type IconName } from '../../shared/components/Icon';
import { ErrorState, Skeleton } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import { routes } from '../../shared/routing/paths';
import { FestivalChips, useFestivalsByDate } from '../festivals';
import { LocationPermissionMessage, useLocationState } from '../location';
import styles from './DaySummaryCard.module.css';
import { useDayHeadline } from './useDayHeadline';
import { useDaySummary } from './usePanchangToday';

const TONE_ICON: Record<DayTone, IconName> = {
  'highly-favorable': 'check',
  favorable: 'check',
  mixed: 'info',
  caution: 'alert',
  avoid: 'alert',
};

/**
 * "How is today?" — the one primary Panchang card on the public home page. Answers, at a glance: how is the day, is
 * now a good time, and when is the next caution period. All values come from the backend.
 */
export function DaySummaryCard({ showDate = true }: Readonly<{ showDate?: boolean }>) {
  const { t } = useTranslation();
  const { query, goodTimes, location, summary, glossary } = useDaySummary();
  const { detecting } = useLocationState();
  const titleId = useId();

  let body;
  if (!location) {
    body = detecting ? <CardSkeleton label={t('location.locating')} /> : <ChooseLocation />;
  } else if (query.isPending) {
    body = <CardSkeleton label={t('states.loading')} />;
  } else if (query.isError || !summary) {
    body = (
      <div className={styles.state}>
        <p className={styles.stateTitle}>{t('summary.errorTitle')}</p>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </div>
    );
  } else {
    body = (
      <SummaryContent
        summary={summary}
        location={location}
        glossary={glossary}
        goodTimeLoading={goodTimes.isPending}
        refreshing={query.isFetching}
        showDate={showDate}
      />
    );
  }

  return (
    <section
      className={styles.card}
      aria-labelledby={titleId}
      aria-busy={query.isFetching || detecting || undefined}
    >
      <h2 id={titleId} className="visually-hidden">
        {t('summary.label')}
      </h2>
      {body}
    </section>
  );
}

function SummaryContent({
  summary,
  location,
  glossary,
  goodTimeLoading,
  refreshing,
  showDate,
}: {
  summary: DaySummary;
  location: SelectedLocation;
  glossary: Glossary | undefined;
  goodTimeLoading: boolean;
  refreshing: boolean;
  showDate: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormatters();
  const tithi = summary.tithi?.current;
  // Festivals and observances on this date (backend, next 90 days).
  const festivals = useFestivalsByDate().festivalsOn(summary.date);
  const headline = useDayHeadline(summary);

  return (
    <div className={styles.content}>
      <div className={showDate ? styles.dateBlock : 'visually-hidden'}>
        <p className={styles.date}>{format.date(summary.date)}</p>
        <p className={styles.meta}>
          {summary.paksha && <span>{t(`summary.paksha.${summary.paksha}`)}</span>}
          {tithi && <span>{tithi.name}</span>}
        </p>
      </div>
      {festivals.length > 0 && (
        <div className={styles.festivals}>
          <FestivalChips festivals={festivals} label={t('festivals.onThisDay')} />
        </div>
      )}

      <div className={styles.tone} data-tone={summary.tone} data-status-tone={summary.tone}>
        <span className={styles.toneIcon}>
          <Icon name={TONE_ICON[summary.tone]} size={28} />
        </span>
        <div className={styles.toneText}>
          <p className={styles.headline}>{headline}</p>
          <p className={styles.description}>{summary.description}</p>
        </div>
      </div>

      <dl className={styles.facts}>
        <GoodTime summary={summary} loading={goodTimeLoading} />
        <Caution status={summary.caution} summary={summary} glossary={glossary} />
      </dl>

      <div className={styles.actions}>
        <Link to={routes.goodTime} className={styles.cta}>
          <Icon name="clock" />
          {t('home.findGoodTime')}
        </Link>
      </div>

      <p className={styles.footnote}>
        {t('summary.localTimeNote', { location: location.label })}
        {refreshing && <span className={styles.refreshing}> · {t('states.refreshing')}</span>}
      </p>
    </div>
  );
}

/**
 * Good time now / next, from the General evaluation: only segments the backend marked `isGoodTime` (conflict-free by
 * construction). Nothing is shown as a Good Time while the evaluation loads or when it failed, and a day without one
 * says so with the backend's message.
 */
function GoodTime({ summary, loading }: { summary: DaySummary; loading: boolean }) {
  const { t } = useTranslation();
  const format = useFormatters();
  const tz = summary.timeZone;
  const status = summary.goodTime;
  if (status.status === 'unavailable' && !loading) return null;

  return (
    <div
      className={styles.fact}
      data-kind={status.status === 'now' || status.status === 'next' ? 'favorable' : 'caution'}
    >
      <dt className={styles.factLabel}>
        <Icon name={status.status === 'now' || status.status === 'next' ? 'check' : 'info'} size={18} />
        {status.status === 'now' ? t('summary.goodTimeNow') : t('summary.nextGoodTime')}
      </dt>
      <dd className={styles.factValue}>
        {status.status === 'unavailable'
          ? t('summary.goodTimeChecking')
          : status.status === 'none'
            ? (summary.noGoodTimeMessage ?? t('summary.noGoodTime'))
            : status.status === 'now'
              ? t('summary.goodTimeUntil', { time: format.time(status.window.end, tz) })
              : format.range(status.window.start, status.window.end, tz, summary.date)}
      </dd>
    </div>
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
  const { t } = useTranslation();
  const format = useFormatters();

  if (status.status === 'none') {
    return (
      <div className={styles.fact} data-kind="caution">
        <dt className={styles.factLabel}>
          <Icon name="alert" size={18} />
          {t('summary.nextCaution')}
        </dt>
        <dd className={styles.factValue}>{t('summary.noCaution')}</dd>
      </div>
    );
  }

  const period = status.window;
  const message = glossary?.periods?.[period.kind]?.message;
  return (
    <div className={styles.fact} data-kind="caution">
      <dt className={styles.factLabel}>
        <Icon name="alert" size={18} />
        {status.status === 'now' ? t('summary.cautionNow') : t('summary.nextCaution')}
      </dt>
      <dd className={styles.factValue}>
        <strong>{period.name}</strong>{' '}
        {format.range(period.start, period.end, summary.timeZone, summary.date)}
        {message && <span className={styles.factNote}>{message}</span>}
      </dd>
    </div>
  );
}

function ChooseLocation() {
  const { t } = useTranslation();
  const { openDialog, detectCurrentLocation, detecting, detectError } = useLocationState();
  return (
    <div className={styles.state}>
      <Icon name="pin" size={28} />
      <p className={styles.stateTitle}>{t('summary.chooseLocationTitle')}</p>
      <p className={styles.description}>{t('summary.chooseLocationBody')}</p>
      {detectError && <LocationPermissionMessage error={detectError} />}
      <div className={styles.actions}>
        <Button onClick={() => void detectCurrentLocation()} loading={detecting}>
          <Icon name="locate" />
          {t('location.useCurrent')}
        </Button>
        <Button variant="secondary" onClick={openDialog}>
          <Icon name="search" />
          {t('location.choose')}
        </Button>
      </div>
    </div>
  );
}

function CardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className={styles.content}>
      <span className="visually-hidden">{label}</span>
      <Skeleton height="1.5rem" width="55%" />
      <Skeleton height="1rem" width="35%" />
      <Skeleton height="2.5rem" width="60%" />
      <Skeleton height="1rem" />
      <Skeleton height="4.5rem" />
      <Skeleton height="4.5rem" />
    </div>
  );
}
