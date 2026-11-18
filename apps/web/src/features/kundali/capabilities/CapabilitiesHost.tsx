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
 */
export function CapabilitiesHost() {
  const { t } = useTranslation();
  const { status, capabilities, reload } = useCapabilities();

  if (status === 'loading') {
    return (
      <p className={styles.loading} data-testid="capabilities-loading" role="status">
        {t('kundali.capabilities.loading')}
      </p>
    );
  }

  if (status === 'error' || capabilities === null) {
    return (
      <div className={styles.failure} data-testid="capabilities-failure" role="status">
        <p>{t('kundali.capabilities.unavailable')}</p>
        <button type="button" className={styles.retry} onClick={reload}>
          {t('kundali.capabilities.retry')}
        </button>
      </div>
    );
  }

  return <CapabilitiesPanel capabilities={capabilities} />;
}
