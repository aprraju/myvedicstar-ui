import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';

import { MAIN_CONTENT_ID, RouteAnnouncer, SkipLink } from '../../shared/accessibility/RouteAnnouncer';
import { useRouteHandle } from '../../shared/accessibility/usePageTitle';
import { useAuth } from '../../shared/auth';
import { OfflineBanner } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { pageMetadataFor } from '../../shared/seo/page-metadata';
import { StructuredDataScript } from '../../shared/seo/StructuredData';
import { useServices } from '../../shared/services/ServicesContext';
import { MobileBottomNavigation } from './MobileBottomNavigation';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import styles from './SiteLayout.module.css';

/** Page chrome shared by all pages: skip link, header, main landmark, footer, route announcements. */
export function SiteLayout() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  // Phones, signed-out home: its menu and footer are on the page (other public pages keep the bottom bar).
  const guestHome = pathname === '/' && !isAuthenticated;
  const guest = !isAuthenticated;
  const { t } = useTranslation();
  const { analytics } = useServices();
  const { title, screen } = useRouteHandle();
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const header = shell?.querySelector(':scope > header');
    if (!shell || !header) return;
    const measure = () =>
      shell.style.setProperty('--today-header-height', `${header.getBoundingClientRect().height}px`);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(header);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      shell.style.removeProperty('--today-header-height');
    };
  }, []);

  useEffect(() => {
    // Public pages carry their own search title; everything else keeps the route title plus the site name.
    const page = pageMetadataFor(pathname);
    document.title = page
      ? `${page.title} · ${t('app.name')}`
      : title === t('app.name')
        ? title
        : `${title} · ${t('app.name')}`;
    analytics.trackScreen(screen);
  }, [title, screen, t, analytics, pathname]);

  return (
    <div
      ref={shellRef}
      className={`${styles.shell} ${styles.mobileShell} ${guest ? styles.guest : ''} ${guestHome ? styles.guestHome : ''}`}
    >
      <SkipLink />
      <SiteHeader todayMobile />
      <OfflineBanner />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <SiteFooter />
      <div className={styles.mobileNavigation}>
        <MobileBottomNavigation />
      </div>
      <RouteAnnouncer title={title} />
      <StructuredDataScript />
      <ScrollRestoration />
    </div>
  );
}
