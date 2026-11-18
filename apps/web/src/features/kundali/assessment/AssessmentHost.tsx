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

  if (status === 'error') {
    return (
      <section className={styles.section} aria-labelledby={titleId}>
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        <div className={styles.alert} role="alert">
          <p className={styles.alertBody}>{t('kundali.section.loadFailed', { section: title })}</p>
          {errorKind === 'notFound' && <p className={styles.alertBody}>{t('kundali.section.notFound')}</p>}
          <button type="button" className={styles.button} onClick={reload}>
            {t('kundali.retry')}
          </button>
        </div>
      </section>
    );
  }

  if (status === 'loading' || data === null) {
    // The loading message lives in a region that OUTLIVES the transition to loaded. If the whole subtree is replaced
    // on success, the role="status" node is destroyed instead of updated, so the completion is never announced - the
    // user hears "loading" and then silence. Keeping one region, and emptying it once the section is ready, means the
    // announcement happens because the text changed while the region stayed in place.
    return (
      <section className={styles.section} aria-labelledby={titleId} aria-busy="true">
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        <p className={styles.loading} role="status">
          {t('kundali.section.loading', { section: title })}
        </p>
      </section>
    );
  }

  return (
    <>
      {/* The section renderer draws the real section; this region reports the transition out of loading so the change
          is announced rather than silently leaving the live region behind. */}
      <div role="status" className="visually-hidden">
        {t('kundali.section.loaded', { section: title })}
      </div>
      {children(data)}
    </>
  );
}
