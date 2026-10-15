import type { Glossary } from '@myvedicstar/contracts';
import type { DayDashboard } from '@myvedicstar/domain-models';
import { useState } from 'react';

import { Icon } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useFormatters } from '../../shared/i18n/useFormatters';
import styles from './MobileDashboard.module.css';
import { PanchangDetails } from './PanchangPanel';
import { PeriodList } from './PeriodList';
import { RatingFactors } from './RatingFactors';

function PanchangPreview({
  dashboard,
  timeZone,
  onExpand,
}: {
  dashboard: DayDashboard;
  timeZone: string;
  onExpand: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormatters();
  return (
    <dl className={styles.panchangRows}>
      {(['tithi', 'nakshatra'] as const).map((key) => {
        const element = dashboard.limbs[key];
        return element ? (
          <div key={key} className={styles.panchangRow}>
            <dt>
              <Icon name={key === 'tithi' ? 'moon' : 'star'} size={18} />
              {t(`dashboard.limbs.${key}`)}
            </dt>
            <dd>
              <button
                type="button"
                className={styles.panchangAction}
                aria-label={`${t(`dashboard.limbs.${key}`)}: ${element.current.name}`}
                onClick={onExpand}
              >
                <span className={styles.panchangValue}>
                  <strong>{element.current.name}</strong>
                  <span>{t('dashboard.until', { time: format.time(element.current.end, timeZone) })}</span>
                </span>
                <Icon name="chevronDown" size={18} />
              </button>
            </dd>
          </div>
        ) : null;
      })}
    </dl>
  );
}

export function MobileDayDetails({
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
  // The Panchang card opens at "See all" (every element); "Show less" folds it to Tithi and Nakshatra.
  const [fullPanchang, setFullPanchang] = useState(true);
  return (
    <>
      <section className={styles.panel} aria-labelledby="mobile-panchang-title">
        <div className={styles.panelHead}>
          <h2 id="mobile-panchang-title">
            {t('dashboard.panchangTitle', { day: format.day(dashboard.summary.date) })}
          </h2>
          <button type="button" aria-expanded={fullPanchang} onClick={() => setFullPanchang(!fullPanchang)}>
            {t(fullPanchang ? 'dashboard.showLess' : 'dashboard.seeAll')} <span aria-hidden="true">›</span>
          </button>
        </div>
        {fullPanchang ? (
          <PanchangDetails dashboard={dashboard} glossary={glossary} timeZone={timeZone} />
        ) : (
          <PanchangPreview dashboard={dashboard} timeZone={timeZone} onExpand={() => setFullPanchang(true)} />
        )}
      </section>
      <details className={styles.disclosure}>
        <summary>
          {t('dashboard.avoidTitle', { day: format.day(dashboard.summary.date) })}{' '}
          <Icon name="chevronDown" size={18} />
        </summary>
        <PeriodList
          id="avoid"
          tone="caution"
          title={t('dashboard.avoidTitle', { day: format.day(dashboard.summary.date) })}
          subtitle={t('dashboard.avoidSubtitle')}
          items={dashboard.avoid}
          glossary={glossary}
          timeZone={timeZone}
          date={dashboard.summary.date}
        />
      </details>
      <details className={styles.disclosure}>
        <summary>
          {t('dashboard.factorsTitle', {
            day: format.day(dashboard.summary.date),
            rating: dashboard.ratingName,
          })}
          <Icon name="chevronDown" size={18} />
        </summary>
        <RatingFactors
          ratingName={dashboard.ratingName}
          factors={dashboard.factors}
          date={dashboard.summary.date}
        />
      </details>
    </>
  );
}
