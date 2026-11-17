import { Link } from 'react-router';

import { useTranslation } from '../../shared/i18n/I18nProvider';
import styles from './Kundali.module.css';

/**
 * Zero-profile guidance (KUN-02). Shown only when the list request succeeded and returned no rows, so a failure is
 * never dressed up as "you have no profiles". The action reuses the existing Astro Profile create flow by linking to it
 * with a return path, rather than duplicating the birth-details form here.
 */
export function EmptyProfiles({ returnTo }: { returnTo: string }) {
  const { t } = useTranslation();
  const createHref = `/astro-profiles?from=${encodeURIComponent(returnTo)}`;

  return (
    <section className={styles.empty} aria-labelledby="kundali-empty-title">
      <h2 className={styles.emptyTitle} id="kundali-empty-title">
        {t('kundali.empty.title')}
      </h2>
      <p className={styles.emptyBody}>{t('kundali.empty.body')}</p>
      <Link className={`${styles.button} ${styles.buttonPrimary}`} to={createHref}>
        {t('kundali.empty.action')}
      </Link>
      <p className={styles.emptyNote}>{t('kundali.empty.returning')}</p>
    </section>
  );
}
