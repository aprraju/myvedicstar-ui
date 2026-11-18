import {
  divisionalState,
  type KundaliCapabilities,
  provisionalDivisions,
  supportedDivisions,
} from '@myvedicstar/contracts';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Capabilities.module.css';

/**
 * The published capability boundary, rendered as three distinguishable states.
 *
 * This component exists so a section never has to guess what the engine can do. It is the specific fix for the drift
 * that produced the Shadbala/Chesta defect: an assumption nobody could check.
 *
 * Rendering rules that carry the meaning:
 *  - **Provisional is its own visual state.** D60 gets a distinct label and its own row. It is not a supported entry
 *    with a footnote, and not an absent entry with an apology.
 *  - **Absent reads as absent.** Never a zero, never an empty cell, never a blank. It says it is not produced, and where
 *    the payload explains why, that explanation is shown as-is.
 *  - Nothing is derived. Every list comes from the payload; a division in neither list simply is not shown as supported.
 */
export function CapabilitiesPanel({ capabilities }: { capabilities: KundaliCapabilities }) {
  const { t } = useTranslation();

  const supported = supportedDivisions(capabilities);
  const provisional = provisionalDivisions(capabilities);

  return (
    <section className={styles.panel} aria-labelledby="kundali-capabilities-heading">
      <h2 className={styles.title} id="kundali-capabilities-heading">
        {t('kundali.capabilities.title')}
      </h2>
      <p className={styles.intro}>{t('kundali.capabilities.intro')}</p>

      <h3 className={styles.subTitle}>{t('kundali.capabilities.divisionalHeading')}</h3>
      <ul className={styles.list} data-testid="divisional-list">
        {supported.length === 0 && provisional.length === 0 && (
          <li className={styles.absent} data-state="absent">
            {t('kundali.capabilities.noneSupported')}
          </li>
        )}
        {supported.map((divisions) => {
          const state = divisionalState(capabilities, divisions);
          return (
            <li
              key={`d${divisions}`}
              className={styles.item}
              data-state={state.kind}
              data-divisions={divisions}
            >
              <span className={styles.chip}>{t('kundali.capabilities.division', { divisions })}</span>
              <span className={styles.stateLabel}>{t('kundali.capabilities.supported')}</span>
            </li>
          );
        })}
        {provisional.map((divisions) => {
          const state = divisionalState(capabilities, divisions);
          return (
            <li
              key={`p${divisions}`}
              className={styles.item}
              data-state={state.kind}
              data-divisions={divisions}
              data-testid={`provisional-${divisions}`}
            >
              <span className={styles.chip}>{t('kundali.capabilities.division', { divisions })}</span>
              {/* The word "provisional" is the accessible content; the styling only reinforces it. */}
              <span className={styles.provisionalLabel}>{t('kundali.capabilities.provisional')}</span>
              <span className={styles.provisionalNote}>{t('kundali.capabilities.provisionalNote')}</span>
            </li>
          );
        })}
      </ul>

      <h3 className={styles.subTitle}>{t('kundali.capabilities.shadbalaHeading')}</h3>
      <ul className={styles.list} data-testid="shadbala-capability-list">
        {capabilities.supportedShadbalaComponents.map((component) => (
          <li key={component} className={styles.item} data-state="supported">
            <span className={styles.chip}>{component}</span>
            <span className={styles.stateLabel}>{t('kundali.capabilities.supported')}</span>
          </li>
        ))}
        {capabilities.unsupportedShadbalaComponents.map((component) => (
          <li key={component} className={styles.item} data-state="absent" data-testid={`absent-${component}`}>
            <span className={styles.chip}>{component}</span>
            {/* Named as unsupported, with no number attached. A withheld component has no value to print. */}
            <span className={styles.absentLabel}>{t('kundali.capabilities.notProduced')}</span>
          </li>
        ))}
      </ul>

      <dl className={styles.conventions}>
        <div className={styles.conventionRow}>
          <dt>{t('kundali.capabilities.nodeConvention')}</dt>
          <dd>{capabilities.lunarNodeConvention}</dd>
        </div>
        <div className={styles.conventionRow}>
          <dt>{t('kundali.capabilities.ascendantConvention')}</dt>
          <dd>{capabilities.ascendantConvention}</dd>
        </div>
        <div className={styles.conventionRow}>
          <dt>{t('kundali.capabilities.birthDateRange')}</dt>
          <dd>
            {t('kundali.capabilities.range', {
              from: capabilities.minimumSupportedBirthDate,
              to: capabilities.maximumSupportedBirthDate,
            })}
          </dd>
        </div>
      </dl>

      {capabilities.unsupportedCapabilities.length > 0 && (
        <>
          <h3 className={styles.subTitle}>{t('kundali.capabilities.limitsHeading')}</h3>
          {/* Server prose, shown verbatim: it is published caveat text, not a code to localize. */}
          <ul className={styles.limits} data-testid="unsupported-capabilities">
            {capabilities.unsupportedCapabilities.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
