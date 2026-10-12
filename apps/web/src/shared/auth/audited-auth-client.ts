import type { ApiClient } from '@myvedicstar/api-client';

import type { AuthClient } from './auth-client';

/** One audit attempt per account session, independent of component mounts or token renewal. */
export function withAuthAudit(
  client: AuthClient,
  api: ApiClient,
  reportFailure: (operation: 'login' | 'logout') => void,
): AuthClient {
  let accountId: string | null = null;
  let login: Promise<unknown> = Promise.resolve();
  let signingOut: Promise<void> | null = null;
  const auditLogin = () => {
    const state = client.getState();
    if (state.status === 'loading') return;
    const nextId = state.user?.id ?? null;
    if (nextId === accountId) return;
    accountId = nextId;
    if (nextId) login = api.auth.login().catch(() => reportFailure('login'));
  };
  client.subscribe(auditLogin);
  auditLogin();

  return {
    ...client,
    async signIn(request) {
      // The app holds a single active account. Switching requires signing out first.
      if (client.getState().user) return;
      await client.signIn(request);
      await login;
    },
    async completeSignIn() {
      const result = await client.completeSignIn();
      if (result.ok) await login;
      return result;
    },
    signOut() {
      if (signingOut) return signingOut;
      signingOut = (async () => {
        await login;
        if (client.getState().user) {
          try {
            await api.auth.logout();
          } catch {
            reportFailure('logout');
          }
        }
        await client.signOut();
      })().finally(() => {
        signingOut = null;
      });
      return signingOut;
    },
  };
}
