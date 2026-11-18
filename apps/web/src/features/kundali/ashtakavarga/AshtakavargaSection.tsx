import type { KundaliAshtakavarga } from '@myvedicstar/contracts';
import { useId } from 'react';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import { AssessmentSection, type SectionState } from '../assessment/AssessmentSection';
import styles from './Ashtakavarga.module.css';
import { AshtakavargaHeatMap } from './AshtakavargaHeatMap';
import { AshtakavargaTable } from './AshtakavargaTable';
import { toValues } from './values';

function sectionState(payload: KundaliAshtakavarga): SectionState {
  if (payload.availability === 'computed') return { availability: 'computed' };
  return { availability: payload.availability, reason: payload.reason ?? 'unknown' };
}

/**
 * KUN-11 — Sarvashtakavarga and Bhinnashtakavarga.
 *
 * Pure presentation of the engine's numbers. The section shell decides availability first: when the section is not
 * computed, the table and heat map are never even evaluated, so an empty grid cannot be mistaken for a chart of zeroes.
 *
 * When computed, the legend, methodology note and version render above the numbers, so the reader knows what system
 * produced them before reading them.
 */
export function AshtakavargaSection({ ashtakavarga }: { ashtakavarga: KundaliAshtakavarga }) {
  const { t } = useTranslation();
  const titleId = useId();
  const values = toValues(ashtakavarga);

  return (
    <AssessmentSection
      state={sectionState(ashtakavarga)}
      titleId={titleId}
      title={t('kundali.ashtakavarga.title')}
      intro={t('kundali.ashtakavarga.intro')}
    >
      {() =>
        values === null || !ashtakavarga.legend || !ashtakavarga.rulesVersion ? (
          // Defensive only: the contract already rejects a computed payload missing these parts. Rendering them as
          // unavailable is still better than rendering a chart with no legend or a table with no values.
          <AssessmentSection
            state={{ availability: 'error', reason: 'rule-set-version-missing' }}
            titleId={`${titleId}-incomplete`}
            title={t('kundali.ashtakavarga.incompleteTitle')}
          >
            {() => null}
          </AssessmentSection>
        ) : (
          <>
            <dl className={styles.legend}>
              <div className={styles.legendRow}>
                <dt className={styles.legendTerm}>{t('kundali.ashtakavarga.method')}</dt>
                <dd className={styles.legendValue}>{ashtakavarga.legend.name}</dd>
              </div>
              <div className={styles.legendRow}>
                <dt className={styles.legendTerm}>{t('kundali.ashtakavarga.rulesVersion')}</dt>
                <dd className={styles.legendValue}>{ashtakavarga.rulesVersion}</dd>
              </div>
              {ashtakavarga.legend.note && (
                <div className={styles.legendRow}>
                  <dt className={styles.legendTerm}>{t('kundali.ashtakavarga.methodNote')}</dt>
                  <dd className={styles.legendValue}>{ashtakavarga.legend.note}</dd>
                </div>
              )}
              <div className={styles.legendRow}>
                <dt className={styles.legendTerm}>{t('kundali.ashtakavarga.grandTotal')}</dt>
                <dd className={styles.legendValue}>{values.grandTotal}</dd>
              </div>
            </dl>

            <AshtakavargaHeatMap values={values} />
            <AshtakavargaTable values={values} />

            {values.weakSigns.length > 0 && (
              <p className={styles.weakNote}>
                {t('kundali.ashtakavarga.weakSigns', {
                  signs: values.weakSigns.map((sign) => t(`kundali.ashtakavarga.sign.${sign}`)).join(', '),
                })}
              </p>
            )}
          </>
        )
      }
    </AssessmentSection>
  );
}
