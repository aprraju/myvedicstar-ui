import type { KundaliOverview } from '@myvedicstar/contracts';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import { useFormatters } from '../../../shared/i18n/useFormatters';
import { resolveField } from './certainty';
import { FieldValue } from './FieldValue';
import styles from './Overview.module.css';

/**
 * The computed blocks of the overview. Availability comes entirely from the payload: a block is shown when present,
 * and its absence is explained by the matching `unsupported` entry. Nothing here decides that a value "should" exist.
 */
export function AstroDetails({ overview }: { overview: KundaliOverview }) {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  const zone = overview.birthDetails.timeZoneId;

  const ascendant = resolveField(overview, 'ascendant', overview.ascendant, (value) => ({
    kind: 'value',
    value: t('kundali.overview.ascendantValue', {
      sign: value.sign,
      // A degree is a quantity, so number formatting is fine here; coordinates are identifiers and are kept as strings.
      degree: value.degreeWithinSign,
      nakshatra: value.nakshatra,
    }),
  }));
  const moon = resolveField(overview, 'moonSign', overview.moonSign, (value) => ({ kind: 'value', value }));
  const sun = resolveField(overview, 'sunSign', overview.sunSign, (value) => ({ kind: 'value', value }));
  const dasha = resolveField(overview, 'currentDasha', overview.currentDasha, (value) => ({
    kind: 'value',
    // endUtc is a UTC instant; it is rendered in the profile's zone, never converted into a different zone first.
    value: t('kundali.overview.dashaValue', {
      lord: value.lord,
      level: value.level,
      ends: dateTime(value.endUtc, zone),
    }),
  }));

  return (
    <section className={styles.section} aria-labelledby="kundali-astro-heading">
      <h2 className={styles.sectionTitle} id="kundali-astro-heading">
        {t('kundali.overview.astroTitle')}
      </h2>
      <dl className={styles.list}>
        <div className={styles.row}>
          <dt className={styles.term}>{t('kundali.overview.ascendant')}</dt>
          <dd className={styles.value}>
            <FieldValue view={ascendant} label={t('kundali.overview.ascendant')} />
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('kundali.overview.moonSign')}</dt>
          <dd className={styles.value}>
            <FieldValue view={moon} label={t('kundali.overview.moonSign')} />
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('kundali.overview.sunSign')}</dt>
          <dd className={styles.value}>
            <FieldValue view={sun} label={t('kundali.overview.sunSign')} />
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('kundali.overview.currentDasha')}</dt>
          <dd className={styles.value}>
            <FieldValue view={dasha} label={t('kundali.overview.currentDasha')} />
          </dd>
        </div>
      </dl>
      {overview.keyPlacements && overview.keyPlacements.length > 0 && (
        <div className={styles.placements}>
          <h3 className={styles.subTitle}>{t('kundali.overview.keyPlacements')}</h3>
          <ul className={styles.placementList}>
            {overview.keyPlacements.map((placement) => (
              <li key={placement.graha} className={styles.placement}>
                {t('kundali.overview.placement', {
                  graha: placement.graha,
                  sign: placement.sign,
                  house: placement.house,
                })}
                {placement.retrograde && (
                  <span className={styles.retrograde}> {t('kundali.overview.retrograde')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
