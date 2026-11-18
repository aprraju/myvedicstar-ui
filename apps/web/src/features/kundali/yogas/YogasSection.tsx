import type { KundaliYogas } from '@myvedicstar/contracts';
import { useId } from 'react';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import { AssessmentSection, type SectionState } from '../assessment/AssessmentSection';
import { YogaAssessmentItem } from './YogaAssessmentItem';
import { YogaFamilyCoverage } from './YogaFamilyCoverage';
import styles from './Yogas.module.css';

/** Maps a loaded payload to the section state the shell understands, without inventing a reason for a computed section. */
function sectionState(yogas: KundaliYogas): SectionState {
  if (yogas.availability === 'computed') return { availability: 'computed' };
  // The contract guarantees a reason for every non-computed state (enforced in the schema); 'unknown' is only a
  // defensive fallback for a payload that bypassed validation.
  return { availability: yogas.availability, reason: yogas.reason ?? 'unknown' };
}

/**
 * KUN-10 — explainable yoga and dosha assessments.
 *
 * Pure presentation: it takes the payload and renders it. No calculation, no client-side yoga rules, no inferred
 * verdicts. Natal and transit findings are rendered in separate groups so a transit activation can never be read as a
 * permanent natal finding; within each group every assessment is an expandable evidence block.
 */
export function YogasSection({ yogas, timeZoneId }: { yogas: KundaliYogas; timeZoneId: string }) {
  const { t } = useTranslation();
  const titleId = useId();

  const natal = yogas.assessments.filter((row) => row.scope === 'natal');
  const transit = yogas.assessments.filter((row) => row.scope === 'transit');

  return (
    <AssessmentSection
      state={sectionState(yogas)}
      titleId={titleId}
      title={t('kundali.yogas.title')}
      intro={t('kundali.yogas.intro')}
      footer={<YogaFamilyCoverage families={yogas.families} />}
    >
      {() => (
        <>
          {natal.length > 0 && (
            <div className={styles.group} data-scope="natal">
              <h3 className={styles.groupTitle}>{t('kundali.yogas.natalGroup')}</h3>
              <ul className={styles.items}>
                {natal.map((assessment) => (
                  <li key={assessment.key}>
                    <YogaAssessmentItem assessment={assessment} timeZoneId={timeZoneId} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {transit.length > 0 && (
            <div className={styles.group} data-scope="transit">
              <h3 className={styles.groupTitle}>{t('kundali.yogas.transitGroup')}</h3>
              <p className={styles.groupNote}>{t('kundali.yogas.transitNote')}</p>
              <ul className={styles.items}>
                {transit.map((assessment) => (
                  <li key={assessment.key}>
                    <YogaAssessmentItem assessment={assessment} timeZoneId={timeZoneId} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* A computed section that returned no rows is stated plainly rather than drawn as an empty list. */}
          {natal.length === 0 && transit.length === 0 && (
            <p className={styles.empty}>{t('kundali.yogas.noneFound')}</p>
          )}

        </>
      )}
    </AssessmentSection>
  );
}
