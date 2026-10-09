import type { LocalDate } from '@myvedicstar/date-time';
import type { DayTimeline as Timeline } from '@myvedicstar/domain-models';

import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import styles from './DashboardPage.module.css';

const percent = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;

/**
 * "Today's timeline": sunrise to next sunrise, with each auspicious or caution period drawn to scale and a marker for
 * now. The bar is a visual overview; the same periods are listed with times (and read by screen readers) below.
 * Positions are set through React's `style` (CSSOM), which the Content-Security-Policy allows.
 */
export function DayTimeline({
  timeline,
  timeZone,
  date,
  locationLabel,
  title,
}: Readonly<{
  timeline: Timeline;
  timeZone: string;
  date: LocalDate;
  locationLabel: string;
  title?: string;
}>) {
  const { t } = useTranslation();
  const format = useFormatters();

  return (
    <section className={`${styles.panel} ${styles.timelinePanel}`} aria-labelledby="timeline-title">
      <h2 id="timeline-title" className={styles.panelTitle}>
        {title ?? t('dashboard.timelineTitle')}
      </h2>
      <p className={styles.panelSubtitle}>{t('dashboard.timelineSubtitle', { location: locationLabel })}</p>

      <div className={styles.timeline} aria-hidden="true">
        <div className={styles.track}>
          {timeline.entries.map((entry) => (
            <span
              key={`${entry.period.kind}-${entry.period.start}`}
              className={styles.segment}
              data-tone={entry.tone}
              data-state={entry.state}
              style={{ left: percent(entry.from), width: percent(entry.to - entry.from) }}
              title={`${entry.period.name} ${format.range(entry.period.start, entry.period.end, timeZone, date)}`}
            />
          ))}
          <span className={styles.sunsetMark} style={{ left: percent(timeline.sunsetAt) }} />
          {timeline.nowAt !== undefined && (
            <span className={styles.nowMark} style={{ left: percent(timeline.nowAt) }}>
              <span className={styles.nowLabel}>{t('dashboard.now')}</span>
            </span>
          )}
        </div>
        <div className={styles.axis}>
          <span>
            {t('dashboard.limbs.sunrise')} {format.time(timeline.start, timeZone)}
          </span>
          <span className={styles.axisMid} style={{ left: percent(timeline.sunsetAt) }}>
            {t('dashboard.limbs.sunset')} {format.time(timeline.sunset, timeZone)}
          </span>
          <span>
            {t('dashboard.nextSunrise')} {format.time(timeline.end, timeZone)}
          </span>
        </div>
      </div>

      <ul className={styles.legend} aria-hidden="true">
        <li data-tone="favorable">{t('dashboard.timelineLegendFavorable')}</li>
        <li data-tone="warning">{t('dashboard.timelineLegendWarning')}</li>
        <li data-tone="caution">{t('dashboard.timelineLegendCaution')}</li>
      </ul>
    </section>
  );
}
