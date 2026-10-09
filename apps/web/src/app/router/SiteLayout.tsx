import { useEffect } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';

import { MAIN_CONTENT_ID, RouteAnnouncer, SkipLink } from '../../shared/accessibility/RouteAnnouncer';
import { useRouteHandle } from '../../shared/accessibility/usePageTitle';
import { OfflineBanner } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useServices } from '../../shared/services/ServicesContext';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import styles from './SiteLayout.module.css';

/** Page chrome shared by all pages: skip link, header, main landmark, footer, route announcements. */
export function SiteLayout() {
  const { t } = useTranslation();
  const { analytics } = useServices();
  const { title, screen } = useRouteHandle();

  useEffect(() => {
    document.title = title === t('app.name') ? title : `${title} · ${t('app.name')}`;
    analytics.trackScreen(screen);
  }, [title, screen, t, analytics]);

  return (
    <div className={styles.shell}>
      <SkipLink />
      <SiteHeader />
      <OfflineBanner />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <SiteFooter />
      <RouteAnnouncer title={title} />
      <ScrollRestoration />
    </div>
  );
}
