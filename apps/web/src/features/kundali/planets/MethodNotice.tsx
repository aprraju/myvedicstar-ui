import type { KundaliPlanets, UnsupportedReason } from '@myvedicstar/contracts';
import type { MessageKey } from '@myvedicstar/localization';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Planets.module.css';

const KNOWN_REASONS: readonly UnsupportedReason[] = [
  'engine-unavailable',
  'birth-time-unknown',
  'birth-time-approximate',
];

/**
 * The reason a fact is missing, as localized text.
 *
 * The server sends codes; this maps them through the catalog. An unknown code renders as a generic sentence instead of
 * the raw identifier, so a new server reason cannot leak an internal token into the interface.
 */
export function ReasonText({ reason }: { reason: UnsupportedReason }) {
  const { t } = useTranslation();
  // Reasons are a closed set at the contract level, so the cast is over a value already validated by the schema.
  const key = (
    KNOWN_REASONS.includes(reason) ? `kundali.planets.reason.${reason}` : 'kundali.planets.reason.unknown'
  ) as MessageKey;
  return (
    <span className={styles.reason} data-reason={reason}>
      {' — '}
      {t(key)}
    </span>
  );
}

/**
 * The method line for the section.
 *
 * AC2: house and aspect facts may not be shown without naming the method that produced them, and an unsupported method
 * may not be substituted silently. `houseSystem` and `aspectMethod` are required in the contract, so this always has
 * real values to print. The identifiers are shown verbatim: they are engine convention names, not user-facing prose,
 * and renaming them for display would hide which convention a reading came from.
 */
export function MethodNotice({ section }: { section: KundaliPlanets }) {
  const { t } = useTranslation();
  const conventions = section.conventions;

  return (
    <div className={styles.methods}>
      <p className={styles.methodLine} data-testid="planet-methods">
        {t('kundali.planets.methods', {
          houseSystem: section.houseSystem,
          aspectMethod: section.aspectMethod,
        })}
      </p>
      {conventions && (
        <p className={styles.provenance} data-testid="planet-conventions">
          {t('kundali.planets.conventions', {
            ayanamsa: conventions.ayanamsa,
            dignityScheme: conventions.dignityScheme,
            combustionOrb: conventions.combustionOrb,
          })}
        </p>
      )}
    </div>
  );
}
