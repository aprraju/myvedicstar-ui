import type { MessageKey } from '@myvedicstar/localization';
import { useEffect, useId, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import { LocationSelector } from '../../features/location';
import { TraditionSelector } from '../../features/tradition';
import { useAuth, useStartSignIn } from '../../shared/auth';
import { Icon, type IconName } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { DEFAULT_AUTHENTICATED_PATH, routes } from '../../shared/routing/paths';
import { MobileAccountMenu } from './MobileAccountMenu';
import { ProfileMenu } from './ProfileMenu';
import styles from './SiteHeader.module.css';

/**
 * Signed-in navigation (myvedicstar-default theme): icon above label. For signed-in users Home is the Panchang page;
 * only Panchang is highlighted there so two items are never active together.
 */
const APP_NAV: { to: string; icon: IconName; label: MessageKey; highlight: boolean }[] = [
  { to: DEFAULT_AUTHENTICATED_PATH, icon: 'home', label: 'nav.home', highlight: false },
  { to: routes.calendar, icon: 'calendar', label: 'nav.calendar', highlight: true },
  { to: routes.festivals, icon: 'flower', label: 'nav.upcomingEvents', highlight: true },
  { to: routes.goodTime, icon: 'clock', label: 'nav.findGoodTime', highlight: true },
  // KUN-01 (#11): Kundali sits immediately after Find Good Time in the signed-in menu.
  { to: routes.kundali, icon: 'star', label: 'nav.kundali', highlight: true },
];

/** Pages whose header omits the tradition selector. */
const NO_TRADITION_PATHS = new Set<string>([routes.home, routes.authCallback]);

/**
 * Public header: brand · Home, Features, About, Help · location · tradition · Login (account menu when signed in).
 * The tradition selector is left out on the home and sign-in pages, which share one header.
 * Layout adapts to the window: one row on wide screens, two rows plus a menu on compact ones (see CSS).
 */
export function SiteHeader({ todayMobile = false }: { todayMobile?: boolean }) {
  const { t } = useTranslation();
  const { enabled, isAuthenticated } = useAuth();
  // Login goes straight to the identity provider's hosted pages (no in-app pages); hidden when sign-in is
  // not configured for the environment.
  const { start, pending } = useStartSignIn();
  const showSignIn = enabled && !isAuthenticated;
  // The menu is open for one URL: navigating anywhere closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const menuId = useId();
  const { pathname, hash } = useLocation();
  const here = `${pathname}${hash}`;
  const showTradition = !NO_TRADITION_PATHS.has(pathname);
  const menuOpen = openAt === here;
  const setMenuOpen = (open: boolean) => setOpenAt(open ? here : null);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpenAt(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.navLink}${isActive ? ` ${styles.active}` : ''}`;

  return (
    <header
      className={`${styles.header} ${todayMobile ? styles.todayMobile : ''}`}
      // Phones, signed out (home, Privacy, Terms, Help…): Om · centred name · Login, as in the home mockup.
      data-guest={showSignIn || undefined}
    >
      <div className={styles.inner}>
        <Link to={routes.home} className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            ॐ
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>{t('app.name')}</span>
            <span className={styles.tagline}>{t('app.tagline')}</span>
          </span>
        </Link>

        <nav
          aria-label={t('a11y.primaryNavigation')}
          className={styles.nav}
          id={menuId}
          data-open={menuOpen}
          data-variant={isAuthenticated ? 'app' : 'public'}
        >
          <ul className={styles.navList}>
            {isAuthenticated ? (
              APP_NAV.map(({ to, icon, label, highlight }) => (
                <li key={label}>
                  <NavLink
                    to={to}
                    className={({ isActive }) => navClass({ isActive: highlight && isActive })}
                    aria-current={highlight ? undefined : false}
                  >
                    <Icon name={icon} size={20} />
                    <span>{t(label)}</span>
                  </NavLink>
                </li>
              ))
            ) : (
              <>
                <li>
                  <NavLink to={routes.home} end className={navClass}>
                    {t('nav.home')}
                  </NavLink>
                </li>
                <li>
                  <Link to={`${routes.home}#features`} className={styles.navLink}>
                    {t('nav.features')}
                  </Link>
                </li>
              </>
            )}
            <li className={isAuthenticated ? styles.compactOnly : undefined}>
              <NavLink to={routes.about} className={navClass}>
                {t('nav.about')}
              </NavLink>
            </li>
            <li className={isAuthenticated ? styles.compactOnly : undefined}>
              <NavLink to={routes.help} className={navClass}>
                {t('nav.help')}
              </NavLink>
            </li>
            {/* Signed in: account options (Settings, Log out) live in the profile menu. */}
            {showSignIn && (
              <>
                <li className={styles.phoneOnly}>
                  <button type="button" className={styles.navLink} onClick={() => void start('login')}>
                    {t('auth.login')}
                  </button>
                </li>
              </>
            )}
          </ul>
        </nav>

        {isAuthenticated && (
          <div className={styles.context}>
            <LocationSelector />
            {showTradition && <TraditionSelector />}
          </div>
        )}

        <div className={styles.actions}>
          {isAuthenticated ? (
            <ProfileMenu />
          ) : (
            showSignIn && (
              <>
                <button
                  type="button"
                  className={`${styles.outline} ${styles.notPhone}`}
                  aria-busy={pending === 'login' || undefined}
                  onClick={() => void start('login')}
                >
                  {t('auth.login')}
                </button>
              </>
            )
          )}
          {isAuthenticated && <MobileAccountMenu className={styles.mobileAccount ?? ''} />}
          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? t('a11y.closeMenu') : t('a11y.openMenu')}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
    </header>
  );
}
