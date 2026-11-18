import { useId } from 'react';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './AssessmentHost.module.css';

/**
 * Fetches are not renderable facts, so a section that is still loading or whose request failed does not borrow the
 * "not available" wording - that wording carries a REASON code from the server, and here there is none yet. The host
 * therefore renders an explicit loading state and an explicit retryable error state, and only hands a payload to the
 * section renderer once a response arrived.
 */
export interface SectionHostProps<T> {
  title: string;
  status: 'loading' | 'ready' | 'error';
  data: T | null;
  errorKind: string | null;
  reload: () => void;
  children: (data: T) => React.ReactNode;
}

export function AssessmentHost<T>({ title, status, data, errorKind, reload, children }: SectionHostProps<T>) {
  const { t } = useTranslation();
  const titleId = useId();
  const loading = status === 'loading' || data === null;

  // The announcement text changes; the node that carries it does not.
  //
  // The defect this guards against is invisible in any single snapshot: a role="status" region that is valid at every
  // moment still fails across time if it is *replaced* rather than updated. Two different nodes with the same role do
  // not fix that - a screen reader has no reason to connect the second node's text to the first node's disappearance,
  // so it may announce nothing at all. The only reliable shape is one node, mounted in one place, whose text changes.
  //
  // "Outside the branches" has to mean outside the RETURNED section too, not merely outside the ternary. A region that
  // lives inside <section> is still unmounted when the branch swaps which <section> is returned, because the two
  // sections are different elements. An already-populated region inserted into the tree is not reliably announced -
  // the ARIA contract is about changes INSIDE an existing region - so the user gets silence, or the wrong announcement,
  // or hears "loaded." in place of the content they were waiting for.
  //
  // Hence: one persistent wrapper element that owns both the region and whichever section is current. The wrapper's
  // identity survives the transition; the section inside it swaps as it must. The region is a sibling of that inner
  // slot and never unmounts.
  const announcement = loading
    ? t('kundali.section.loading', { section: title })
    : status === 'error'
      ? t('kundali.section.loadFailed', { section: title })
      : t('kundali.section.loaded', { section: title });

  return (
    // Stable outer node: this is the only element that lives across the whole lifecycle. React keeps it mounted, so the
    // live region below it is never inserted or removed - only its text changes.
    <div className={styles.host}>
      {/* One region for the whole section lifecycle, mounted before and after every transition. */}
      <div role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </div>

      {status === 'error' ? (
        <section className={styles.section} aria-labelledby={titleId}>
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
          {/* role="alert" here is the visible error panel, not a second live region for the same event: it carries the
              actionable retry control, and the region above carries the one-line announcement. */}
          <div className={styles.alert} role="alert">
            <p className={styles.alertBody}>{t('kundali.section.loadFailed', { section: title })}</p>
            {errorKind === 'notFound' && <p className={styles.alertBody}>{t('kundali.section.notFound')}</p>}
            <button type="button" className={styles.button} onClick={reload}>
              {t('kundali.retry')}
            </button>
          </div>
        </section>
      ) : loading ? (
        <section className={styles.section} aria-labelledby={titleId} aria-busy="true">
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
          {/* Visual only: the live region above already carries this text. A second copy here would be read twice by
              anything that queries the page text, and duplicated announcements are their own defect. */}
          <p className={styles.loading} aria-hidden="true">
            {t('kundali.section.loading', { section: title })}
          </p>
        </section>
      ) : (
        children(data as T)
      )}
    </div>
  );
}
