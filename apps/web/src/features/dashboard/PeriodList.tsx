import type { Glossary } from '@myvedicstar/contracts';
import type { LocalDate } from '@myvedicstar/date-time';
import { mobilePeriodOrder, type PeriodItem } from '@myvedicstar/domain-models';
import { useState } from 'react';

import { Icon } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import styles from './DashboardPage.module.css';

/**
 * A titled list of periods with times, the glossary's short guidance, and a Now / Over badge.
 * A favorable period with an unfavorable overlap is a resolved conflict (`tone: 'warning'`): orange warning icon, no
 * "good for …" message, and instead one line per overlap — "Overlaps with Dur Muhurtam: 1:20 PM – 1:44 PM".
 */
export function PeriodList({
  id,
  tone,
  title,
  subtitle,
  items,
  glossary,
  timeZone,
  date,
  previewCount,
}: Readonly<{
  id: string;
  tone: 'favorable' | 'caution';
  title: string;
  subtitle: string;
  items: readonly PeriodItem[];
  glossary: Glossary | undefined;
  timeZone: string;
  date: LocalDate;
  previewCount?: number;
}>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const [expanded, setExpanded] = useState(false);
  const ordered = previewCount ? mobilePeriodOrder(items) : items;
  const visible = previewCount && !expanded ? ordered.slice(0, previewCount) : ordered;
  const headingId = `${id}-title`;

  return (
    <section
      data-compact={previewCount ? true : undefined}
      className={styles.panel}
      aria-labelledby={headingId}
    >
      <div className={styles.sectionTitle} data-tone={tone}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <Icon name={tone === 'favorable' ? 'check' : 'alert'} size={18} />
        </span>
        <div>
          <h2 id={headingId} className={styles.sectionHeading}>
            {title}
          </h2>
          <p className={styles.sectionSubtitle}>{subtitle}</p>
        </div>
        {previewCount && items.length > 0 && (
          <button
            type="button"
            className={styles.previewAction}
            aria-expanded={expanded}
            aria-controls={`${id}-list`}
            onClick={() => setExpanded(!expanded)}
          >
            {t(expanded ? 'dashboard.showLess' : 'dashboard.seeAll')} <Icon name="chevronDown" size={16} />
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>{t('dashboard.noneToday')}</p>
      ) : (
        <ul id={`${id}-list`} className={styles.list}>
          {visible.map(({ period, tone: itemTone, state, overlaps }) => {
            const message = glossary?.periods?.[period.kind]?.message;
            const heading = (
              <>
                {' '}
                <span className={styles.listName}>
                  {period.name}
                  {(previewCount || state !== 'upcoming') && (
                    <span className={styles.badge} data-state={state}>
                      {state === 'now'
                        ? t('dashboard.now')
                        : state === 'upcoming'
                          ? t('dashboard.upcoming')
                          : t('dashboard.over')}
                    </span>
                  )}
                </span>
                <span className={styles.listTime}>
                  {format.range(period.start, period.end, timeZone, date)}
                </span>
              </>
            );
            return (
              <li key={`${period.kind}-${period.start}`} className={styles.listItem} data-state={state}>
                <span className={styles.listIcon} data-tone={itemTone} aria-hidden="true">
                  <Icon name={itemTone === 'warning' ? 'alert' : 'clock'} size={16} />
                </span>
                <div className={styles.listText}>
                  {previewCount ? (
                    <details className={styles.periodDetails}>
                      <summary aria-label={t('dashboard.periodDetails') + ': ' + period.name}>
                        {heading}
                        <span className={styles.periodChevron} aria-hidden="true">
                          <Icon name="chevronDown" size={18} />
                        </span>
                      </summary>
                      <p className={styles.listNote}>
                        {glossary?.periods?.[period.kind]?.meaning ?? period.classification}
                      </p>
                    </details>
                  ) : (
                    heading
                  )}
                  {overlaps.length === 0 && message && <span className={styles.listNote}>{message}</span>}
                  {overlaps.map((overlap) => (
                    <span key={`${overlap.kind}-${overlap.start}`} className={styles.conflict}>
                      <span aria-hidden="true">⚠</span>{' '}
                      {t('dashboard.overlapsWith', {
                        name: overlap.name,
                        time: format.range(overlap.start, overlap.end, timeZone, date),
                      })}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
