import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { useAuth } from '../../shared/auth';
import { EmptyState, LoadingState } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { RedirectToSignIn } from './RedirectToSignIn';

/**
 * Guards authenticated routes. Waits while a session is restored, then sends unauthenticated users straight to the
 * identity provider with their destination preserved (validated again after the provider redirects back). When
 * sign-in is not configured for the environment, explains that instead.
 */
export function ProtectedRoute({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useTranslation();
  const { enabled, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState />;
  if (isAuthenticated) return children;
  if (!enabled) {
    return (
      <section aria-labelledby="sign-in-unavailable">
        <h1 id="sign-in-unavailable" className="page-title">
          {t('auth.signInRequired')}
        </h1>
        <EmptyState title={t('auth.notConfigured')} />
      </section>
    );
  }
  return (
    <RedirectToSignIn intent="login" returnTo={`${location.pathname}${location.search}${location.hash}`} />
  );
}
