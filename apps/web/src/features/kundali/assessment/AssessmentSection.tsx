import type { AssessmentAvailability, AssessmentReason } from '@myvedicstar/contracts';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Assessment.module.css';

/**
 * Shared availability handling for every Kundali assessment section (KUN-10 yogas, KUN-11 ashtakavarga, and the
 * sections still to come).
 *
 * The point of this module is that "the engine cannot produce this" is a rendered state with a reason code, not an
 * empty component. It is deliberately impossible to render an empty section by accident:
 *
 *  - A section renders its content through {@link AssessmentSection}, which requires an explicit `state` describing
 *    availability. `computed` renders children; anything else renders the explained unavailable panel and NEVER the
 *    children - so there is no code path where a chart or table can appear next to "not available", and none where an
 *    empty list is passed off as a real (empty) result.
 *  - Reasons are codes from the contract, mapped to localized wording. A code we do not have wording for still shows
 *    the generic reason, so a new server reason never renders as nothing or as raw English from the engine.
 */

/** The section states a caller may pass. Mirrors the contract enum, without importing the zod runtime into the UI. */
export type SectionState =
  | { availability: 'computed' }
  | { availability: Exclude<AssessmentAvailability, 'computed'>; reason: AssessmentReason };

/** Maps a reason code to localized text. Unknown codes fall back to the generic reason, never to the code itself. */
export function useReasonText() {
  const { t, tDynamic } = useTranslation();
  // tDynamic, not t: the key is built from a server code, so an unrecognised reason falls back to the generic wording
  // instead of echoing the raw code to the user.
  return (reason: AssessmentReason): string =>
    tDynamic(`kundali.assessment.reason.${reason}`, undefined, t('kundali.assessment.reason.unknown'));
}

export function AssessmentUnavailable({ reason }: { reason: AssessmentReason }) {
  const { t } = useTranslation();
  const reasonText = useReasonText();

  return (
    <div className={styles.unavailable} data-state="unavailable" data-reason={reason}>
      <p className={styles.unavailableTitle}>{t('kundali.assessment.unavailableTitle')}</p>
      <p className={styles.unavailableBody}>
        {t('kundali.assessment.unavailableBody', { reason: reasonText(reason) })}
      </p>
      {/* The code is shown as provenance so a support conversation can name it exactly, and so a test can assert on it. */}
      <p className={styles.reasonCode}>
        {t('kundali.assessment.reasonCode', { code: reason })}
      </p>
    </div>
  );
}

/**
 * Renders a section, or its explained unavailable state.
 *
 * `children` is not evaluated for a non-computed state: the unavailable panel is returned instead, so no partially
 * populated chart can be painted underneath an explanation.
 */
export function AssessmentSection({
  state,
  titleId,
  title,
  intro,
  footer,
  children,
}: {
  state: SectionState;
  titleId: string;
  title: string;
  intro?: string;
  /** Coverage or legend shown in every state, including unsupported: what the section WOULD report, and why not. */
  footer?: React.ReactNode;
  children: () => React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <section className={styles.section} aria-labelledby={titleId} data-availability={state.availability}>
      <h2 className={styles.sectionTitle} id={titleId}>
        {title}
      </h2>
      {intro && <p className={styles.intro}>{intro}</p>}
      {state.availability === 'computed' ? (
        children()
      ) : (
        <AssessmentUnavailable reason={state.reason} />
      )}
      {footer}
      {state.availability === 'computed' && (
        <p className={styles.provenance}>{t('kundali.assessment.provenance')}</p>
      )}
    </section>
  );
}
