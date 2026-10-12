import { createApiClient } from '@myvedicstar/api-client';
import { describe, expect, it, vi } from 'vitest';

import { withAuthAudit } from './audited-auth-client';
import { createInMemoryAuthClient } from './auth-client';

function setup() {
  const client = createInMemoryAuthClient();
  const requests: { path: string; token: string | null }[] = [];
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    requests.push({ path: String(input), token: new Headers(init?.headers).get('Authorization') });
    return new Response(null, { status: 204 });
  });
  const api = createApiClient({
    baseUrl: 'https://api.example/api/v1',
    getAccessToken: client.getAccessToken,
    fetchImpl,
  });
  const failure = vi.fn();
  return { client, auth: withAuthAudit(client, api, failure), requests, fetchImpl, failure };
}

describe('authentication audits', () => {
  it('audits each login once and logs out with a token before clearing the account', async () => {
    const { auth, requests } = setup();
    await auth.signIn({ intent: 'login', returnTo: '/' });
    await auth.signIn({ intent: 'login', returnTo: '/' });
    await Promise.all([auth.signOut(), auth.signOut()]);
    expect(requests).toEqual([
      { path: 'https://api.example/api/v1/auth/login', token: 'Bearer mock-access-token' },
      { path: 'https://api.example/api/v1/auth/logout', token: 'Bearer mock-access-token' },
    ]);
    expect(auth.getState().user).toBeNull();
    await auth.signIn({ intent: 'login', returnTo: '/' });
    expect(requests).toHaveLength(3);
  });

  it('waits for logout audit completion before clearing the session', async () => {
    const { auth, fetchImpl } = setup();
    await auth.signIn({ intent: 'login', returnTo: '/' });
    let finish!: (response: Response) => void;
    fetchImpl.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const logout = auth.signOut();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    expect(auth.getState().user).not.toBeNull();
    finish(new Response(null, { status: 204 }));
    await logout;
    expect(auth.getState().user).toBeNull();
  });

  it('reports audit failures and still allows logout without retrying', async () => {
    const { auth, fetchImpl, failure } = setup();
    fetchImpl.mockRejectedValue(new TypeError('offline'));
    await auth.signIn({ intent: 'login', returnTo: '/' });
    await auth.signOut();
    expect(failure.mock.calls).toEqual([['login'], ['logout']]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(auth.getState().user).toBeNull();
  });
});
