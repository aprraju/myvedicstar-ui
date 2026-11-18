import type { KundaliOverview } from '@myvedicstar/contracts';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import { AstroDetails } from './AstroDetails';
import { BirthDetails } from './BirthDetails';
import styles from './Overview.module.css';

/**
 * KUN-05 overview: birth details plus the astrological blocks the engine could compute.
 *
 * Pure presentation. It takes the payload as a prop and renders it; it does not fetch, compute or repair values.
 * There is deliberately NO export, PDF, share or chart-art control here - Save as PDF lives only inside Reports.
 */
export function OverviewPage({ overview }: { overview: KundaliOverview }) {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label={t('kundali.overview.breadcrumbLabel')}>
        <span>{t('app.name')}</span>
        <span aria-hidden="true"> / </span>
        <span aria-current={undefined}>{t('nav.kundali')}</span>
      </nav>
      <h1 className={styles.title}>{t('kundali.overview.title')}</h1>
      <p className={styles.subtitle}>
        {t('kundali.overview.subtitle', { name: overview.birthDetails.name })}
      </p>

      <BirthDetails details={overview.birthDetails} />
      <AstroDetails overview={overview} />

      <p className={styles.conventions}>
        {t('kundali.overview.conventions', {
          ephemeris: overview.conventions.ephemerisProvider,
          version: overview.conventions.ephemerisVersion,
          ayanamsa: overview.conventions.ayanamsa,
          houseSystem: overview.conventions.houseSystem,
        })}
      </p>
    </div>
  );
}
