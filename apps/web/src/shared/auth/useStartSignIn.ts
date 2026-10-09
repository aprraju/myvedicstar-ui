import { sanitizeReturnPath } from '@myvedicstar/config';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

import { DEFAULT_AUTHENTICATED_PATH, paths } from '../routing/paths';
import { useServices } from '../services/ServicesContext';

export type SignInIntent = 'login' | 'register';

/**
 * Starts sign-in (or sign-up) at the identity provider — the only way into authentication; there are no in-app
 * login/register pages. Redirecting clients (Entra External ID, OIDC) leave the page; in-process clients (mock) are
 * signed in when the promise resolves, so the user is taken to the destination here. Failures to even start (e.g.
 * offline) show the sign-in error view.
 */
export function useStartSignIn() {
  const { auth } = useServices();
  const navigate = useNavigate();
  const [pending, setPending] = useState<SignInIntent | null>(null);

  const start = useCallback(
    async (intent: SignInIntent, returnTo?: string) => {
      const destination = sanitizeReturnPath(returnTo, DEFAULT_AUTHENTICATED_PATH);
      setPending(intent);
      try {
        await auth.signIn({ intent, returnTo: destination });
        if (auth.getState().user) {
          setPending(null);
          navigate(destination, { replace: true });
        }
        // Otherwise the browser is navigating to the provider; stay busy until it does.
      } catch {
        setPending(null);
        navigate(paths.signInError('failed', destination), { replace: true });
      }
    },
    [auth, navigate],
  );

  return { start, pending };
}
