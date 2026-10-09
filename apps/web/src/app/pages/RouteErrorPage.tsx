import { useEffect } from 'react';
import { Link, useRouteError } from 'react-router';

import { Button } from '../../shared/components/Button';
import { ErrorState } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { routes } from '../../shared/routing/paths';
import { useServices } from '../../shared/services/ServicesContext';

/**
 * Router-level error boundary (e.g. a lazy chunk failed to load after a deployment, or a render error).
 * Shows a friendly message — never a stack trace — and reports the error.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const { t } = useTranslation();
  const { telemetry } = useServices();

  useEffect(() => {
    telemetry.trackException(error, { source: 'RouteErrorPage' });
  }, [error, telemetry]);

  return (
    <main id="main-content" tabIndex={-1} className="stack error-page">
      <h1 className="page-title">{t('errors.unexpected')}</h1>
      <ErrorState error={error} />
      <p className="cluster">
        <Button onClick={() => window.location.reload()}>{t('errors.reload')}</Button>
        <Link to={routes.home}>{t('pages.notFound.action')}</Link>
      </p>
    </main>
  );
}
