import { NavLink } from 'react-router';

import { useAuth } from '../../shared/auth';
import { Icon, type IconName } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { routes } from '../../shared/routing/paths';
import styles from './MobileBottomNavigation.module.css';
import { ProfileMenu } from './ProfileMenu';

export function MobileBottomNavigation() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
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
      {isAuthenticated ? (
        <ProfileMenu placement="bottom-navigation" />
      ) : (
        <NavLink to={routes.profile} className={styles.navItem ?? ''}>
          <Icon name="user" size={21} />
          <span>{t('nav.profile')}</span>
        </NavLink>
      )}
    </nav>
  );
}
