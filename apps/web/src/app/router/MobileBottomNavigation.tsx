import { NavLink } from 'react-router';

import { useAuth } from '../../shared/auth';
import { GuestMenu } from '../../shared/components/GuestMenu';
import { Icon, type IconName } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { routes } from '../../shared/routing/paths';
import styles from './MobileBottomNavigation.module.css';

export function MobileBottomNavigation() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <GuestBottomNavigation />;
  const items: {
    to: string;
    label: 'nav.today' | 'nav.calendar' | 'nav.goodTime' | 'nav.upcomingEvents';
    icon: IconName;
  }[] = [
    { to: routes.dashboard, label: 'nav.today', icon: 'sun' },
    { to: routes.calendar, label: 'nav.calendar', icon: 'calendar' },
    { to: routes.goodTime, label: 'nav.goodTime', icon: 'clock' },
    { to: routes.festivals, label: 'nav.upcomingEvents', icon: 'flower' },
  ];
  return (
    <nav className={styles.bottomNavigation} aria-label={t('dashboard.mobileNavigation')}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
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
