import { Link, useLocation } from 'react-router';

import { useAuth, useStartSignIn } from '../auth';
import { useTranslation } from '../i18n/I18nProvider';
import { routes } from '../routing/paths';
import styles from './GuestMenu.module.css';
import { Icon, type IconName } from './Icon';

/** Where signed-out visitors can write to us (`mailto:` opens the device's own mail app on phones). */
export const CONTACT_EMAIL = 'contact@myvedicstar.com';

/** The three things the app offers, each opening its page after sign-in. */
const FEATURES: { id: 'panchang' | 'goodTimes' | 'festivals'; to: string; icon: IconName }[] = [
  { id: 'panchang', to: routes.dashboard, icon: 'calendar' },
  { id: 'goodTimes', to: routes.goodTime, icon: 'clock' },
  { id: 'festivals', to: routes.festivals, icon: 'flower' },
];

/**
 * Signed-out visitors on phones: Home · Daily Panchang · Good Times · Festivals (each signs in like Login / Sign Up, then opens
 * its page) and Privacy · Terms · Help · Contact. On the home page it is part of the page; on other public pages it is
 * the fixed bottom bar.
 */
export function GuestMenu() {
  const { t } = useTranslation();
  const { enabled } = useAuth();
  const { start, pending } = useStartSignIn();
  const { pathname } = useLocation();
  return (
    <div className={styles.menu}>
      <ul className={styles.features} aria-label={t('home.mobile.featuresLabel')}>
        <li>
          <Link
            to={routes.home}
            className={styles.feature}
            aria-current={pathname === routes.home ? 'page' : undefined}
          >
            <Icon name="home" size={24} />
            {t('home.mobile.features.home')}
          </Link>
        </li>
        {FEATURES.map(({ id, to, icon }) => (
          <li key={id}>
            {enabled ? (
              <button
                type="button"
                className={styles.feature}
                aria-busy={pending === 'login' || undefined}
                onClick={() => void start('login', to)}
              >
                <Icon name={icon} size={24} />
                {t(`home.mobile.features.${id}`)}
              </button>
            ) : (
              <Link to={to} className={styles.feature}>
                <Icon name={icon} size={24} />
                {t(`home.mobile.features.${id}`)}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <nav className={styles.links} aria-label={t('footer.shortNavigation')}>
        <Link to={routes.privacy}>{t('home.mobile.links.privacy')}</Link>
        <Link to={routes.terms}>{t('home.mobile.links.terms')}</Link>
        <Link to={routes.help}>{t('home.mobile.links.help')}</Link>
        <a href={`mailto:${CONTACT_EMAIL}`}>{t('home.mobile.links.contact')}</a>
      </nav>
    </div>
  );
}
