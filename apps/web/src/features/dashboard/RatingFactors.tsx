import type { GuidanceFactor } from '@myvedicstar/contracts';
import { dashboardFactorReason, toneForRating } from '@myvedicstar/domain-models';

import { Icon } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import styles from './DashboardPage.module.css';

const ICON_BY_TONE = {
  'highly-favorable': 'check',
  favorable: 'check',
  mixed: 'info',
  caution: 'alert',
  avoid: 'alert',
} as const;

/** "Why today is …": the backend's rating of each Panchanga limb and its reason (text and icon, never color alone). */
export function RatingFactors({
  ratingName,
  factors,
}: Readonly<{ ratingName: string; factors: readonly GuidanceFactor[] }>) {
  const { t } = useTranslation();
  return (
    <section className={styles.panel} aria-labelledby="factors-title">
      <div className={styles.sectionTitle} data-tone="info">
        <span className={styles.sectionIcon} aria-hidden="true">
          <Icon name="info" size={18} />
        </span>
        <div>
          <h2 id="factors-title" className={styles.sectionHeading}>
            {t('dashboard.factorsTitle', { rating: ratingName })}
          </h2>
          <p className={styles.sectionSubtitle}>{t('dashboard.factorsSubtitle')}</p>
        </div>
      </div>
      <ul className={styles.list}>
        {factors.map((factor) => {
          const tone = toneForRating(factor.rating);
          return (
            <li key={`${factor.limb}-${factor.key}`} className={styles.listItem}>
              <span className={styles.listIcon} data-tone={tone} data-status-tone={tone} aria-hidden="true">
                <Icon name={ICON_BY_TONE[tone]} size={16} />
              </span>
              <div className={styles.listText}>
                <span className={styles.listName}>
                  {factor.limbName}: {factor.name}
                  <span className={styles.badge} data-tone={tone} data-status-tone={tone}>
                    {factor.ratingName}
                  </span>
                </span>
                <span className={styles.listNote}>{dashboardFactorReason(factor)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
