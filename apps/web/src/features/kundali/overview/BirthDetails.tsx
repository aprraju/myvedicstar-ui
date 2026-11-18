import type { BirthDetails as BirthDetailsData } from '@myvedicstar/contracts';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import { useFormatters } from '../../../shared/i18n/useFormatters';
import styles from './Overview.module.css';

/**
 * Birth details exactly as recorded on the profile.
 *
 * The three time modes are presented distinctly and never collapsed into one another:
 *   exact       -> the time
 *   approximate -> the window, stated as a window, with the uncertainty called out
 *   unknown     -> explicitly not recorded, and no time string is produced at all
 * There is no fallback to noon, midnight or sunrise anywhere in this component.
 */
export function BirthDetails({ details }: { details: BirthDetailsData }) {
  const { t } = useTranslation();
  const { date } = useFormatters();

  return (
    <section className={styles.section} aria-labelledby="kundali-birth-heading">
      <h2 className={styles.sectionTitle} id="kundali-birth-heading">
        {t('kundali.overview.birthTitle')}
      </h2>
      <dl className={styles.list}>
        <div className={styles.row}>
          <dt className={styles.term}>{t('kundali.overview.name')}</dt>
          <dd className={styles.value}>{details.name}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('kundali.overview.birthDate')}</dt>
          <dd className={styles.value}>{date(details.birthDate)}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('kundali.overview.birthTime')}</dt>
          <dd className={styles.value}>
            {details.birthTimeMode === 'exact' && <span data-testid="birth-time">{details.birthTime}</span>}
            {details.birthTimeMode === 'approximate' && (
              <span data-testid="birth-time-window" className={styles.range}>
                <span className="visually-hidden">{t('kundali.overview.approximateLabel')} </span>
                {t('kundali.overview.range', {
                  from: details.windowStart ?? '',
                  to: details.windowEnd ?? '',
                })}
              </span>
            )}
            {details.birthTimeMode === 'unknown' && (
              // No time value exists in the payload for this mode; the schema already forbids one.
              <span data-testid="birth-time-unknown" className={styles.unavailable} data-state="unavailable">
                {t('kundali.overview.timeNotRecorded')}
              </span>
            )}
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('kundali.overview.place')}</dt>
          <dd className={styles.value}>{details.placeName}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('kundali.overview.coordinates')}</dt>
          <dd className={styles.value}>
            {/* Coordinates are passed as strings: the translator number-formats its params, which would round
                78.4867 to 78.487. A coordinate is an identifier, not a display quantity, so precision is preserved. */}
            {t('kundali.overview.coordinatePair', {
              latitude: String(details.latitude),
              longitude: String(details.longitude),
            })}
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.term}>{t('kundali.overview.timeZone')}</dt>
          <dd className={styles.value}>{details.timeZoneId}</dd>
        </div>
      </dl>
    </section>
  );
}
