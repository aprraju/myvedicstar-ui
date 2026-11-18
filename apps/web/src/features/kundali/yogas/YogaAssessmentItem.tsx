import type { YogaAssessment } from '@myvedicstar/contracts';
import { useId } from 'react';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import { useFormatters } from '../../../shared/i18n/useFormatters';
import styles from './Yogas.module.css';

/**
 * One assessment, as a native <details> disclosure.
 *
 * <details>/<summary> is used rather than a custom expander so keyboard operation, focus and the expanded/collapsed
 * state are the browser's own, with no JS state to get wrong. The evidence is in the DOM whether open or closed, so
 * find-in-page and screen-reader virtual buffers reach the conditions, placements, exceptions and cancellations.
 *
 * Status is never colour-only: the badge pairs a dot with its text label, and the summary line carries the verdict in
 * words as well.
 */
export function YogaAssessmentItem({ assessment, timeZoneId }: { assessment: YogaAssessment; timeZoneId: string }) {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  const headingId = useId();

  return (
    <details className={styles.item} data-scope={assessment.scope} data-status={assessment.status}>
      <summary className={styles.summary} aria-describedby={headingId}>
        <span className={styles.itemName}>{assessment.name}</span>
        <span className={styles.badges}>
          <span className={styles.status} data-status={assessment.status}>
            <span aria-hidden="true" className={styles.statusDot} />
            {t(`kundali.yogas.status.${assessment.status}`)}
          </span>
          <span className={styles.scope} data-scope={assessment.scope}>
            {t(`kundali.yogas.scope.${assessment.scope}`)}
          </span>
        </span>
      </summary>

      <div className={styles.evidence}>
        <p className={styles.ruleSet} id={headingId}>
          {t('kundali.yogas.ruleSet', { version: assessment.ruleSetVersion })}
        </p>

        {/* A transit finding is dated: it is a moving sky, never a permanent natal statement. */}
        {assessment.scope === 'transit' && assessment.referenceInstant && (
          <p className={styles.transitNote}>
            {t('kundali.yogas.transitReference', {
              when: dateTime(assessment.referenceInstant, timeZoneId),
            })}
          </p>
        )}

        <h4 className={styles.evidenceTitle}>{t('kundali.yogas.conditions')}</h4>
        <ul className={styles.conditions}>
          {assessment.conditions.map((condition) => (
            <li key={condition.code} className={styles.condition} data-truth={condition.truth}>
              {/* The truth marker is text, not colour: "Met" / "Not met" / "Cannot be determined". */}
              <span className={styles.conditionTruth}>{t(`kundali.yogas.truth.${condition.truth}`)}</span>
              <span className={styles.conditionText}>{condition.text}</span>
            </li>
          ))}
        </ul>

        <FactorList title={t('kundali.yogas.supporting')} factors={assessment.supporting} kind="supporting" />
        <FactorList title={t('kundali.yogas.opposing')} factors={assessment.opposing} kind="opposing" />
        <FactorList title={t('kundali.yogas.exceptions')} factors={assessment.exceptions} kind="exceptions" />
        <FactorList title={t('kundali.yogas.cancellations')} factors={assessment.cancellations} kind="cancellations" />
      </div>
    </details>
  );
}

/**
 * An evidence category. An empty category renders an explicit "none recorded" line rather than disappearing: a missing
 * section would read as "this yoga has no exceptions", which is a different claim from "the rule set lists none".
 */
function FactorList({
  title,
  factors,
  kind,
}: {
  title: string;
  factors: YogaAssessment['supporting'];
  kind: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.factorGroup} data-kind={kind}>
      <h4 className={styles.evidenceTitle}>{title}</h4>
      {factors.length === 0 ? (
        <p className={styles.factorNone}>{t('kundali.yogas.noneRecorded')}</p>
      ) : (
        <ul className={styles.factors}>
          {factors.map((factor) => (
            <li key={factor.code}>{factor.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
