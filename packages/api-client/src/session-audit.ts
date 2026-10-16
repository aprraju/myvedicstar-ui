import type { UserInfo } from '@myvedicstar/contracts';

import type { ApiClient } from './client';

interface SessionClient {
  getState(): { status: 'loading' | 'ready'; user: { id: string } | null };
  subscribe(listener: () => void): () => void;
}

/**
 * Register/audit the account before publishing it to consumers that read account-owned data. The login response is the
 * user's info for the session: `onLogin` receives it before the account is published (e.g. to seed the query cache).
 */
export function createSessionAudit<T extends SessionClient>(
  client: T,
  api: ApiClient,
  reportFailure: (operation: 'login' | 'logout') => void,
  onLogin?: (userId: string, userInfo: UserInfo) => void,
) {
  type State = ReturnType<T['getState']>;
  let state = client.getState() as State;
  let accountId: string | null = null;
  let generation = 0;
  let registering = false;
  let login: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = () => {
    state = (registering ? { status: 'loading', user: null } : client.getState()) as State;
    listeners.forEach((listener) => listener());
  };
  const changed = () => {
    const next = client.getState();
    if (next.status === 'loading') {
      publish();
      return;
    }
    const id = next.user?.id ?? null;
    if (id !== accountId) {
      accountId = id;
      const currentGeneration = ++generation;
      registering = id !== null;
      if (id)
        login = api.auth
          .login()
          .then((userInfo) => {
            if (generation === currentGeneration) onLogin?.(id, userInfo);
          })
          .catch(() => reportFailure('login'))
          .finally(() => {
            if (generation === currentGeneration) {
              registering = false;
              publish();
            }
          });
    }
    publish();
  };
  client.subscribe(changed);
  changed();
  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    waitForLogin: () => login,
    auditLogout: async () => {
      await login;
      if (client.getState().user) {
        try {
          await api.auth.logout();
        } catch {
          reportFailure('logout');
        }
      }
    },
  };
}
