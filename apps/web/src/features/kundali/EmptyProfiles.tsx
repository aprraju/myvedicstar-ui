import { Link, useNavigate } from 'react-router';

import { useTranslation } from '../../shared/i18n/I18nProvider';
import { DEFAULT_AUTHENTICATED_PATH } from '../../shared/routing/paths';
import styles from './Kundali.module.css';

/**
 * Zero-profile guidance (KUN-02). Shown only when the list request succeeded and returned no rows, so a failure is
 * never dressed up as "you have no profiles".
 *
 * Two real actions: creating a profile reuses the existing Astro Profile form (linked with a return path, so saving
 * comes back here), and Cancel goes back to where the user was without creating anything. Cancel is a real control,
 * not a promise in prose — the previous version only described it in a sentence.
 */
export function EmptyProfiles({
  returnTo,
  backTo = DEFAULT_AUTHENTICATED_PATH,
}: {
  returnTo: string;
  /** Where Cancel goes. Defaults to the signed-in Home (the Panchang page). */
  backTo?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createHref = `/astro-profiles?from=${encodeURIComponent(returnTo)}`;

  return (
    <section className={styles.empty} aria-labelledby="kundali-empty-title">
      <h2 className={styles.emptyTitle} id="kundali-empty-title">
        {t('kundali.empty.title')}
      </h2>
      <p className={styles.emptyBody}>{t('kundali.empty.body')}</p>
      <div className={styles.actions}>
        <Link className={`${styles.button} ${styles.buttonPrimary}`} to={createHref}>
          {t('kundali.empty.action')}
        </Link>
        <button type="button" className={styles.button} onClick={() => void navigate(backTo)}>
          {t('kundali.empty.cancel')}
        </button>
      </div>
    </section>
  );
}
