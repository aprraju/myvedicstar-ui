import { NavLink } from 'react-router';

import { useAuth } from '../../shared/auth';
import { GuestMenu } from '../../shared/components/GuestMenu';
import { Icon, type IconName } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { DEFAULT_AUTHENTICATED_PATH, routes } from '../../shared/routing/paths';
import styles from './MobileBottomNavigation.module.css';

export function MobileBottomNavigation() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <GuestBottomNavigation />;
  // Home is the Panchang page; only Panchang is highlighted there so two items are never active together.
  const items: {
    to: string;
    label: 'nav.home' | 'nav.calendar' | 'nav.goodTime' | 'nav.upcomingEvents';
    icon: IconName;
    highlight: boolean;
  }[] = [
    { to: DEFAULT_AUTHENTICATED_PATH, label: 'nav.home', icon: 'home', highlight: false },
    { to: routes.calendar, label: 'nav.calendar', icon: 'calendar', highlight: true },
    { to: routes.goodTime, label: 'nav.goodTime', icon: 'clock', highlight: true },
    { to: routes.festivals, label: 'nav.upcomingEvents', icon: 'flower', highlight: true },
  ];
  return (
    <nav className={styles.bottomNavigation} aria-label={t('dashboard.mobileNavigation')}>
      {items.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          className={({ isActive }) => `${styles.navItem} ${isActive && item.highlight ? styles.active : ''}`}
          aria-current={item.highlight ? undefined : false}
        >
          <Icon name={item.icon} size={21} />
          <span>{t(item.label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Signed-out visitors: the home page's menu, fixed at the bottom — Daily Panchang · Good Times · Festivals (each signs
 * in like Login, then opens its page) and Privacy · Terms · Help · Contact.
 */
function GuestBottomNavigation() {
  return (
    <div className={styles.guestBar}>
      <GuestMenu />
    </div>
  );
}
