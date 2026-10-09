import { sanitizeReturnPath } from '@myvedicstar/config';
import type { MessageKey } from '@myvedicstar/localization';
import { useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { useAuth, useStartSignIn } from '../../shared/auth';
import { Button } from '../../shared/components/Button';
import { LoadingState } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { DEFAULT_AUTHENTICATED_PATH, paths, routes, SIGN_IN_ERROR_PARAM } from '../../shared/routing/paths';
import { useServices } from '../../shared/services/ServicesContext';
import styles from './AuthCallbackPage.module.css';

/** Error codes in `?signin_error=` — never free text from the provider. */
const ERROR_MESSAGES: Record<string, MessageKey> = {
  cancelled: 'auth.signInCancelled',
  network: 'auth.signInNetwork',
  failed: 'auth.signInFailed',
};

/**
 * `/auth/callback`: completes the redirect back from the identity provider, then continues to the validated `returnTo`
 * destination. Provider responses (`?code=…` or `?error=…`, both with `state`) are always processed first. Failures
 * replace the URL with `?signin_error=<code>` (removing the code, state and any provider text) and show a friendly
 * message with "Try again" and "Home".
 */
export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get(SIGN_IN_ERROR_PARAM);
  const returnTo = sanitizeReturnPath(searchParams.get('returnTo'), DEFAULT_AUTHENTICATED_PATH);
  return error ? <SignInError code={error} returnTo={returnTo} /> : <CompleteSignIn />;
}

function CompleteSignIn() {
  const { t } = useTranslation();
  const { client } = useAuth();
  const { telemetry } = useServices();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; the code can only be exchanged once.
    started.current = true;
    void client.completeSignIn().then((result) => {
      const returnTo = sanitizeReturnPath(result.returnTo, DEFAULT_AUTHENTICATED_PATH);
      if (result.ok) {
        navigate(returnTo, { replace: true });
        return;
      }
      telemetry.trackMetric('auth.signInFailed', 1, { reason: result.reason });
      navigate(paths.signInError(result.reason, returnTo), { replace: true });
    });
  }, [client, navigate, telemetry]);

  return <LoadingState label={t('auth.completing')} />;
}

function SignInError({ code, returnTo }: Readonly<{ code: string; returnTo: string }>) {
  const { t } = useTranslation();
  const { enabled } = useAuth();
  const { start, pending } = useStartSignIn();

  return (
    <section className={styles.page} aria-labelledby="sign-in-error-title">
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.mark} aria-hidden="true">
            ॐ
          </span>
          <h1 id="sign-in-error-title" className={styles.title}>
            {t('auth.signInErrorTitle')}
          </h1>
        </div>
        <p role="alert" className={styles.error}>
          {t(ERROR_MESSAGES[code] ?? 'auth.signInFailed')}
        </p>
        <div className={styles.actions}>
          {enabled && (
            <Button fullWidth loading={pending === 'login'} onClick={() => void start('login', returnTo)}>
              {t('states.retry')}
            </Button>
          )}
          <Link to={routes.home} className={styles.homeLink}>
            {t('nav.home')}
          </Link>
        </div>
      </div>
    </section>
  );
}
