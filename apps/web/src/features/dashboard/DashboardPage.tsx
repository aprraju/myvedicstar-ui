import { useSyncExternalStore } from 'react';

import { displayNameOf, useAuth, useUserInfo } from '../../shared/auth';
import { Skeleton } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import { DaySummaryCard } from '../today';
import styles from './DashboardPage.module.css';
import { DayTimeline } from './DayTimeline';
import { MobileDashboard } from './MobileDashboard';
import { PanchangPanel } from './PanchangPanel';
import { PeriodList } from './PeriodList';
import { RatingFactors } from './RatingFactors';
import { useDayDashboard } from './useDayDashboard';

/**
 * Authenticated Today dashboard (myvedicstar-default theme): sunrise banner with the date, the day's status and next
 * good / caution times, today's Panchang, a sunrise-to-sunrise timeline, auspicious times, times to avoid
 * and why the day has its rating. Every value comes from the backend for the selected location and tradition; times are
 * shown in the location's time zone.
 */
function subscribeDashboardWidth(listener: () => void) {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

export function DashboardPage() {
  const mobile = useSyncExternalStore(
    subscribeDashboardWidth,
    () => window.innerWidth < 1024,
    () => false,
  );
  return mobile ? <MobileDashboard /> : <DesktopDashboard />;
}

function DesktopDashboard() {
  const { t } = useTranslation();
  const format = useFormatters();
  const { user } = useAuth();
  const { userInfo } = useUserInfo();
  // "Namaste, <name>": the profile from the Authorize API's userinfo, else the identity token's name.
  const name = displayNameOf(userInfo, user?.displayName);
  const { query, location, dashboard, glossary } = useDayDashboard();
  const summary = dashboard?.summary;

  return (
    <section aria-labelledby="dashboard-title" className={styles.page}>
      <div className={styles.hero}>
        <p className={styles.greeting}>
          {name ? t('dashboard.greeting', { name }) : t('dashboard.greetingAnonymous')}
        </p>
        {/* The page heading stays "Dashboard" for navigation and screen readers; the date is the visual title. */}
        <h1 id="dashboard-title" className={summary ? 'visually-hidden' : styles.title}>
          {t('pages.dashboard.title')}
        </h1>
        {summary && (
          <>
            <p className={styles.title}>{format.date(summary.date)}</p>
            <p className={styles.meta}>
              {summary.paksha && <span>{t(`summary.paksha.${summary.paksha}`)}</span>}
              {summary.tithi && <span>{summary.tithi.current.name}</span>}
              {location && <span>{location.label}</span>}
            </p>
          </>
        )}
      </div>

      <div className={styles.overlap}>
        <div className={styles.topGrid}>
          <DaySummaryCard showDate={false} />
          {/* Errors and the "choose a location" prompt are shown by the summary card. */}
          {dashboard && location ? (
            <PeriodList
              id="auspicious"
              tone="favorable"
              title={t('dashboard.auspiciousTitle', { day: format.day(dashboard.summary.date) })}
              subtitle={t('dashboard.auspiciousSubtitle')}
              items={dashboard.auspicious}
              glossary={glossary}
              timeZone={location.timeZone}
              date={dashboard.summary.date}
            />
          ) : (
            location && <PanelSkeleton failed={query.isError} />
          )}
        </div>
      </div>

      {dashboard && location && (
        <>
          <DayTimeline
            timeline={dashboard.timeline}
            timeZone={location.timeZone}
            date={dashboard.summary.date}
            locationLabel={location.label}
          />
          <div className={styles.columns}>
            {glossary !== undefined && (
              <PanchangPanel dashboard={dashboard} glossary={glossary} timeZone={location.timeZone} />
            )}
            <PeriodList
              id="avoid"
              tone="caution"
              title={t('dashboard.avoidTitle', { day: format.day(dashboard.summary.date) })}
              subtitle={t('dashboard.avoidSubtitle')}
              items={dashboard.avoid}
              glossary={glossary}
              timeZone={location.timeZone}
              date={dashboard.summary.date}
            />
            <RatingFactors
              ratingName={dashboard.ratingName}
              factors={dashboard.factors}
              date={dashboard.summary.date}
            />
          </div>
        </>
      )}
    </section>
  );
}

function PanelSkeleton({ failed }: Readonly<{ failed: boolean }>) {
  const { t } = useTranslation();
  if (failed) return null;
  return (
    <div className={styles.panel} role="status" aria-live="polite">
      <span className="visually-hidden">{t('states.loading')}</span>
      <div className={styles.panelBody}>
        <Skeleton height="1.5rem" width="45%" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} height="1.75rem" />
        ))}
      </div>
    </div>
  );
}
