import type { YogaFamilySupport } from '@myvedicstar/contracts';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import { useReasonText } from '../assessment/AssessmentSection';
import styles from './Yogas.module.css';

/**
 * Which of the owner's seven named families this payload can actually speak to.
 *
 * Without this, a response containing two assessments would look like the engine evaluated two yogas and found nothing
 * else, when in fact five families have no rules yet. Each unavailable family states its own reason code.
 */
export function YogaFamilyCoverage({ families }: { families: YogaFamilySupport[] }) {
  const { t } = useTranslation();
  const reasonText = useReasonText();

  if (families.length === 0) return null;

  return (
    <div className={styles.coverage}>
      <h3 className={styles.coverageTitle}>{t('kundali.yogas.coverageTitle')}</h3>
      <ul className={styles.coverageList}>
        {families.map((family) => (
          <li key={family.family} className={styles.coverageItem} data-available={family.available}>
            <span className={styles.coverageName}>{t(`kundali.yogas.family.${family.family}`)}</span>
            <span className={styles.coverageState}>
              {family.available
                ? t('kundali.yogas.coverageAvailable')
                : t('kundali.yogas.coverageUnavailable', {
                    reason: reasonText(family.reason ?? 'unknown'),
                  })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
