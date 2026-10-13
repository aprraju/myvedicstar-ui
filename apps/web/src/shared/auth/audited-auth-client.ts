import { type ApiClient, createSessionAudit } from '@myvedicstar/api-client';

import type { AuthClient } from './auth-client';

/** One audit attempt per account session, independent of component mounts or token renewal. */
export function withAuthAudit(
  client: AuthClient,
  api: ApiClient,
  reportFailure: (operation: 'login' | 'logout') => void,
): AuthClient {
  const audit = createSessionAudit(client, api, reportFailure);
  let signingOut: Promise<void> | null = null;

  return {
    ...client,
    getState: audit.getState,
    subscribe: audit.subscribe,
    async signIn(request) {
      // The app holds a single active account. Switching requires signing out first.
      if (client.getState().user) return;
      await client.signIn(request);
      await audit.waitForLogin();
    },
    async completeSignIn() {
      const result = await client.completeSignIn();
      if (result.ok) {
        await audit.waitForLogin();
        // A rejected API token can clear the session during the login audit.
        // Do not enter a protected route, which would immediately start another redirect.
        if (!client.getState().user) {
          return { ok: false, reason: 'failed', returnTo: result.returnTo };
        }
      }
      return result;
    },
    signOut() {
      if (signingOut) return signingOut;
      signingOut = (async () => {
        await audit.auditLogout();
        await client.signOut();
      })().finally(() => {
        signingOut = null;
      });
      return signingOut;
    },
  };
}
