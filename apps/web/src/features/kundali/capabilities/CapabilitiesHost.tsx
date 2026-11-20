import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Capabilities.module.css';
import { CapabilitiesPanel } from './CapabilitiesPanel';
import { useCapabilities } from './useCapabilities';

/**
 * Loads and renders the capability boundary, without ever holding up the page.
 *
 * Account-independent by design: it takes no profile, so it can render before a profile is chosen and does not depend on
 * any other request. While loading it shows a quiet placeholder rather than a spinner that shifts the layout; on failure
 * it says the boundary could not be loaded and stops there.
 *
 * On failure it deliberately shows nothing about capabilities rather than a default set. A stale or invented boundary
 * would reintroduce exactly the drift this feature removes.
 *
 * The announcement lives in ONE region rendered outside every branch, carrying only its text. Each earlier structure
 * returned its own element per state, so loading -> error|ready unmounted one live region and mounted another. Each of
 * those was valid markup at every moment and still announced nothing: a screen reader has no reason to connect the
 * second node's text to the first node's disappearance. The visible copy, the failure explanation and the retry button
 * are siblings inside their own branches - the region above them is the only thing that survives the transition.
 */
export function CapabilitiesHost() {
  const { t } = useTranslation();
  const { status, capabilities, reload } = useCapabilities();

  const announcement =
    status === 'loading' ? t('kundali.capabilities.loading') : t('kundali.capabilities.unavailable');

  return (
    <>
      {/* One region for the whole lifecycle. Mounted from first render and never replaced - only its text changes. */}
      <div
        role="status"
        aria-live="polite"
        className="visually-hidden"
        data-testid="capabilities-announcement"
      >
        {announcement}
      </div>

      {status === 'loading' ? (
        // The visible copy is aria-hidden: the region above already carries this exact sentence, and a duplicate inside
        // a live region would be announced twice.
        <p className={styles.loading} data-testid="capabilities-loading" aria-hidden="true">
          {t('kundali.capabilities.loading')}
        </p>
      ) : status === 'error' || capabilities === null ? (
        <div className={styles.failure} data-testid="capabilities-failure">
          <p>{t('kundali.capabilities.unavailable')}</p>
          <button type="button" className={styles.retry} onClick={reload}>
            {t('kundali.capabilities.retry')}
          </button>
        </div>
      ) : (
        <CapabilitiesPanel capabilities={capabilities} />
      )}
    </>
  );
}
