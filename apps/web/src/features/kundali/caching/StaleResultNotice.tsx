import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Caching.module.css';
import type { ResultIdentity } from './revision';

/**
 * Shown when a section is displaying a result computed for an earlier revision of the profile.
 *
 * The rule this enforces: a stale result is never presented as current. It is not hidden either, because hiding it
 * would take away information the user is looking at. It is labelled, names WHICH revision it came from and which one
 * is now wanted, and is paired with an explicit action.
 *
 * Both identities are required props rather than optional ones. A generic "this may be out of date" notice tells the
 * user nothing they can act on and tells a screen-reader user even less; the reason for the staleness IS the content.
 */
export function StaleResultNotice({
  requested,
  computedFor,
  onRefresh,
  refreshing,
}: {
  /** The identity the section now wants. */
  requested: ResultIdentity;
  /** The identity the visible value was actually computed under. */
  computedFor: ResultIdentity;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { t } = useTranslation();

  // Which input moved. Reported as the difference the user can recognise: an edit to the profile, a change to the
  // calculation settings, or an engine upgrade. Revision is the commonest and is named explicitly.
  const changed =
    requested.revision !== computedFor.revision
      ? t('kundali.caching.changedRevision', {
          from: computedFor.revision,
          to: requested.revision,
        })
      : t('kundali.caching.changedSettings');

  return (
    <div className={styles.staleNotice} role="status" data-testid="stale-result-notice">
      <p className={styles.staleText}>
        {t('kundali.caching.stale')} {changed}
      </p>
      <button
        type="button"
        className={styles.refreshButton}
        onClick={onRefresh}
        disabled={refreshing}
        aria-busy={refreshing}
      >
        {refreshing ? t('kundali.caching.refreshing') : t('kundali.caching.refresh')}
      </button>
    </div>
  );
}

/** Shown while a newer revision's result is being fetched, so the wait is explained rather than blank. */
export function RefreshingNotice() {
  const { t } = useTranslation();
  return (
    <p className={styles.refreshing} role="status" data-testid="refreshing-notice">
      {t('kundali.caching.refreshing')}
    </p>
  );
}
