import { useEffect, useRef } from 'react';

import { type SignInIntent, useStartSignIn } from '../../shared/auth';
import { LoadingState } from '../../shared/components/states';
import { useTranslation } from '../../shared/i18n/I18nProvider';

/** Starts sign-in as soon as it renders (protected routes), showing a status message while the redirect begins. */
export function RedirectToSignIn({ intent, returnTo }: Readonly<{ intent: SignInIntent; returnTo: string }>) {
  const { t } = useTranslation();
  const { start } = useStartSignIn();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; start one redirect only.
    started.current = true;
    void start(intent, returnTo);
  }, [start, intent, returnTo]);
  return <LoadingState label={t('auth.redirecting')} />;
}
