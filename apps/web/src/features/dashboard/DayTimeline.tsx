import type { LocalDate } from '@myvedicstar/date-time';
import type { DayTimeline as Timeline } from '@myvedicstar/domain-models';
import { useSyncExternalStore } from 'react';

import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import styles from './DashboardPage.module.css';

const percent = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;

function subscribeWidth(listener: () => void) {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

/**
 * "Today's timeline": sunrise to next sunrise, with each auspicious or caution period drawn to scale and a marker for
 * now. The bar is a visual overview; the same periods are listed with times (and read by screen readers) below.
 * Positions are set through React's `style` (CSSOM), which the Content-Security-Policy allows.
 */
export function DayTimeline({
  timeline,
  timeZone,
  date,
  title,
  compact: compactOverride,
  onExpand,
}: Readonly<{
  timeline: Timeline;
  timeZone: string;
  date: LocalDate;
  locationLabel: string;
  title?: string;
  compact?: boolean;
  onExpand?: () => void;
}>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const mobile = useSyncExternalStore(
    subscribeWidth,
    () => window.innerWidth < 1024,
    () => false,
  );
  const compact = compactOverride ?? mobile;

  const chart = (
    <div className={styles.timeline} data-compact={compact || undefined} aria-hidden="true">
      <div className={styles.track}>
        {timeline.entries.map((entry) => (
          <span
            key={`${entry.period.kind}-${entry.period.start}`}
            className={styles.segment}
            data-tone={entry.tone}
            data-state={entry.state}
            style={{
              left: percent(entry.from),
              width: percent(entry.to - entry.from),
              ...(compact
                ? { top: entry.tone === 'caution' ? 28 : entry.tone === 'warning' ? 14 : 0, height: 12 }
                : {}),
            }}
            title={`${entry.period.name} ${format.range(entry.period.start, entry.period.end, timeZone, date)}`}
          />
        ))}
        <span className={styles.sunsetMark} style={{ left: percent(timeline.sunsetAt) }} />
        {timeline.nowAt !== undefined && (
          <span className={styles.nowMark} style={{ left: percent(timeline.nowAt) }}>
            <span
              className={styles.nowLabel}
              style={
                compact
                  ? {
                      transform:
                        timeline.nowAt < 0.1
                          ? 'none'
                          : timeline.nowAt > 0.9
                            ? 'translateX(-100%)'
                            : undefined,
                    }
                  : undefined
              }
            >
              {t('dashboard.now')}
            </span>
          </span>
        )}
      </div>
      <div className={styles.axis}>
        <span>
          {t('dashboard.limbs.sunrise')}
          {compact ? <br /> : ' '}
          {format.time(timeline.start, timeZone)}
        </span>
        <span className={styles.axisMid} style={{ left: percent(timeline.sunsetAt) }}>
          {t('dashboard.limbs.sunset')}
          {compact ? <br /> : ' '}
          {format.time(timeline.sunset, timeZone)}
        </span>
        <span>
          {t('dashboard.nextSunrise')}
          {compact ? <br /> : ' '}
          {format.time(timeline.end, timeZone)}
        </span>
      </div>
    </div>
  );

  return (
    <section
      className={`${styles.panel} ${styles.timelinePanel}`}
      data-compact={compact || undefined}
      aria-labelledby="timeline-title"
    >
      <h2 id="timeline-title" className={styles.panelTitle}>
        {title ?? t('dashboard.timelineTitle')}
      </h2>

      {onExpand ? (
        <button
          type="button"
          className={styles.compactTimelineButton}
          aria-label={t('dashboard.timelineDetails')}
          onClick={onExpand}
        >
          {chart}
        </button>
      ) : (
        chart
      )}

      <ul className={styles.legend} aria-hidden="true">
        <li data-tone="favorable">{t('dashboard.timelineLegendFavorable')}</li>
        <li data-tone="warning">{t('dashboard.timelineLegendWarning')}</li>
        <li data-tone="caution">{t('dashboard.timelineLegendCaution')}</li>
      </ul>
    </section>
  );
}
