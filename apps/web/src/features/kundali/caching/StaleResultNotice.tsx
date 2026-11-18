import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Caching.module.css';

/**
 * Shown when a section is displaying a result computed for an earlier revision of the profile.
 *
 * The rule this enforces: a stale result is never presented as current. It is not hidden either, because hiding it
 * would take away information the user is looking at. It is labelled, dated against the revision it came from, and
 * paired with an explicit action. Three things happen together, and none is optional:
 *  - the value stays visible (it exists and may still be useful),
 *  - the text says it predates the current profile revision,
 *  - a refresh control is present and keyboard reachable.
 */
export function StaleResultNotice({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  const { t } = useTranslation();

  return (
    <div className={styles.staleNotice} role="status" data-testid="stale-result-notice">
      <p className={styles.staleText}>{t('kundali.caching.stale')}</p>
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
