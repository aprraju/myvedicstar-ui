import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from '../Kundali.module.css';
import { reasonKey } from '../reasonText';
import { reportAvailability, type ReportVariant, reportVariantValues } from './reportAvailability';

/**
 * KUN-17 reports panel.
 *
 * Two rules shape this:
 *  - The variant choice is presented as a real choice, because it is the part of the feature the contract already
 *    fixes (`short|detailed`). Nothing about it is guessed.
 *  - The download action is NOT a disabled button. A disabled control with no explanation is silent degradation: the
 *    user cannot tell whether they lack permission, whether it failed, or whether it does not exist yet. Instead the
 *    panel states plainly that generation is not built, names the reason through the shared reason vocabulary, and
 *    lists what is outstanding.
 *
 * There is deliberately no `onDownload` prop. A handler would imply a contract; there is none to call.
 */
export function ReportsPanel({ profileName }: { profileName: string }) {
  const { t } = useTranslation();
  const availability = reportAvailability();

  return (
    <section className={styles.section} aria-labelledby="kundali-reports-heading">
      <h2 className={styles.sectionTitle} id="kundali-reports-heading">
        {t('kundali.reports.title')}
      </h2>
      <p className={styles.subtitle}>{t('kundali.reports.subtitle', { name: profileName })}</p>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('kundali.reports.variantLegend')}</legend>
        {reportVariantValues.map((variant: ReportVariant) => (
          <label key={variant} className={styles.modeOption}>
            {/* Kept enabled: choosing a variant is meaningful even while generation is unavailable, so the user can
                see what will be offered. Only the action is blocked, and it says why. */}
            <input
              type="radio"
              name="kundali-report-variant"
              value={variant}
              defaultChecked={variant === 'short'}
            />
            <span>{t(`kundali.reports.variant.${variant}`)}</span>
          </label>
        ))}
      </fieldset>
      <p className={styles.hint}>{t('kundali.reports.variantHint')}</p>

      <section className={styles.unavailable} aria-labelledby="kundali-reports-unavailable">
        <h3 className={styles.unavailableTitle} id="kundali-reports-unavailable">
          {t('kundali.reports.notAvailableTitle')}
        </h3>
        <p className={styles.unavailableBody}>{t('kundali.reports.notAvailableBody')}</p>
        {availability.reason && <p className={styles.reason}>{t(reasonKey(availability.reason))}</p>}
        <ul className={styles.placementList}>
          {availability.gaps.map((gap) => (
            <li key={gap} className={styles.placement}>
              {t(`kundali.reports.gap.${gap}`)}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
