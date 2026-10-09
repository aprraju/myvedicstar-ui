import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

import { useTranslation } from '../i18n/I18nProvider';

export const MAIN_CONTENT_ID = 'main-content';

/**
 * Client-side navigation does not reload the page, so screen readers get no signal and focus stays on the clicked
 * link. After each navigation (not the first load) this moves focus to <main> and announces the new page title.
 */
export function RouteAnnouncer({ title }: { title: string }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [message, setMessage] = useState('');
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById(MAIN_CONTENT_ID)?.focus({ preventScroll: false });
    setMessage(t('a11y.pageLoaded', { title }));
    // Announce once per navigation; `title` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}

export function SkipLink() {
  const { t } = useTranslation();
  return (
    <a className="skip-link" href={`#${MAIN_CONTENT_ID}`}>
      {t('a11y.skipToContent')}
    </a>
  );
}
