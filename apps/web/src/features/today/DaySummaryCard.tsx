import type { Glossary, TimePeriod } from '@myvedicstar/contracts';
import type { DaySummary, DayTone, WindowStatus } from '@myvedicstar/domain-models';
import type { SelectedLocation } from '@myvedicstar/domain-models';
import { useId } from 'react';
import { Link } from 'react-router';

import { Icon, type IconName } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import { routes } from '../../shared/routing/paths';
import { FestivalChips, useFestivalsByDate } from '../festivals';
import styles from './DaySummaryCard.module.css';
import { useDayHeadline } from './useDayHeadline';

const TONE_ICON: Record<DayTone, IconName> = {
  'highly-favorable': 'check',
  favorable: 'check',
  mixed: 'info',
  caution: 'alert',
  avoid: 'alert',
};

function SummaryContent({
  summary,
  location,
  glossary,
  goodTimeLoading,
  todayOnly,
  refreshing,
  showDate,
  mobile,
}: {
  summary: DaySummary;
  location: SelectedLocation;
  glossary: Glossary | undefined;
  goodTimeLoading: boolean;
  todayOnly: boolean;
  refreshing: boolean;
  showDate: boolean;
  mobile: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormatters();
  const tithi = summary.tithi?.current;
  // Festivals and observances on this date (backend, next 90 days).
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
      {!todayOnly && !mobile && <SummaryFestivals date={summary.date} />}

      <div className={styles.tone} data-tone={summary.tone} data-status-tone={summary.tone}>
        <span className={styles.toneIcon}>
          <Icon name={TONE_ICON[summary.tone]} size={28} />
        </span>
        <div className={styles.toneText}>
          <p className={styles.headline}>{headline}</p>
          <p className={styles.description}>{summary.description}</p>
          {mobile && !todayOnly && <SummaryFestivals date={summary.date} />}
        </div>
      </div>

      {summary.isToday && (
        <dl className={styles.facts}>
          <GoodTime summary={summary} loading={goodTimeLoading} showUnavailable={mobile} />
          <Caution status={summary.caution} summary={summary} glossary={glossary} />
        </dl>
      )}

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

/** Present a selected calendar day using the same card without fetching today's data. */
export function SelectedDaySummaryCard({
  summary,
  location,
  glossary,
  mobile,
  goodTimeLoading = false,
}: {
  summary: DaySummary;
  location: SelectedLocation;
  glossary: Glossary | undefined;
  mobile: boolean;
  goodTimeLoading?: boolean;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section className={`${styles.card} ${mobile ? styles.mobile : ''}`} aria-labelledby={titleId}>
      <h2 id={titleId} className="visually-hidden">
        {t('summary.label')}
      </h2>
      <SummaryContent
        summary={summary}
        location={location}
        glossary={glossary}
        mobile={mobile}
        goodTimeLoading={goodTimeLoading}
        todayOnly
        refreshing={false}
        showDate={false}
      />
    </section>
  );
}

/**
 * Good time now / next, from the General evaluation: only segments the backend marked `isGoodTime` (conflict-free by
 * construction). Nothing is shown as a Good Time while the evaluation loads or when it failed, and a day without one
 * says so with the backend's message.
 */
function GoodTime({
  summary,
  loading,
  showUnavailable = false,
}: {
  summary: DaySummary;
  loading: boolean;
  showUnavailable?: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormatters();
  const tz = summary.timeZone;
  const status = summary.goodTime;
  if (status.status === 'unavailable' && !loading && !showUnavailable) return null;

  return (
    <div
      className={styles.fact}
      data-kind={status.status === 'now' || status.status === 'next' ? 'favorable' : 'caution'}
    >
      <dt className={styles.factLabel}>
        <Icon name={status.status === 'now' || status.status === 'next' ? 'check' : 'info'} size={18} />
        {status.status === 'now' ? t('summary.goodTimeNow') : t('summary.nextGoodTime')}
      </dt>
      <dd
        className={`${styles.factValue} ${status.status === 'now' || status.status === 'next' ? styles.factTime : ''}`}
      >
        {status.status === 'unavailable'
          ? t(loading ? 'summary.goodTimeChecking' : 'dashboard.goodTimeUnavailable')
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
        <strong className={styles.cautionName}>{period.name}</strong>{' '}
        <span className={styles.factTime}>
          {format.range(period.start, period.end, summary.timeZone, summary.date)}
        </span>
        {message && <span className={styles.factNote}>{message}</span>}
      </dd>
    </div>
  );
}

function SummaryFestivals({ date }: { date: string }) {
  const { t } = useTranslation();
  const festivals = useFestivalsByDate().festivalsOn(date);
  return festivals.length > 0 ? (
    <div className={styles.festivals}>
      <FestivalChips festivals={festivals} label={t('festivals.onThisDay')} />
    </div>
  ) : null;
}
