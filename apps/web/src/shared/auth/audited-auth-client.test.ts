import { createApiClient } from '@myvedicstar/api-client';
import { describe, expect, it, vi } from 'vitest';

import { withAuthAudit } from './audited-auth-client';
import { createInMemoryAuthClient } from './auth-client';

function setup() {
  const client = createInMemoryAuthClient();
  const requests: { path: string; token: string | null }[] = [];
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    requests.push({ path: String(input), token: new Headers(init?.headers).get('Authorization') });
    return String(input).endsWith('/auth/login')
      ? Response.json(userInfo)
      : new Response(null, { status: 204 });
  });
  const api = createApiClient({
    baseUrl: 'https://api.example/api/v1',
    getAccessToken: client.getAccessToken,
    fetchImpl,
  });
  const failure = vi.fn();
  const onLogin = vi.fn();
  return {
    client,
    auth: withAuthAudit(client, api, failure, onLogin),
    requests,
    fetchImpl,
    failure,
    onLogin,
  };
}

const userInfo = {
  id: 'mock-user',
  name: 'Asha',
  email: 'asha@example.com',
  firstName: 'Asha',
  lastName: 'Rao',
};

describe('authentication audits', () => {
  it('keeps account consumers loading until backend registration completes', async () => {
    const { auth, fetchImpl } = setup();
    let finish!: (response: Response) => void;
    fetchImpl.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const signingIn = auth.signIn({ intent: 'login', returnTo: '/settings' });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    expect(auth.getState()).toEqual({ status: 'loading', user: null });
    finish(Response.json(userInfo));
    await signingIn;
    expect(auth.getState()).toMatchObject({ status: 'ready', user: { id: 'mock-user' } });
  });
  it('hands the login response to onLogin before publishing the account (no separate userinfo request)', async () => {
    const { auth, onLogin, failure, requests } = setup();
    onLogin.mockImplementation(() => expect(auth.getState().user).toBeNull());
    await auth.signIn({ intent: 'login', returnTo: '/' });
    expect(onLogin).toHaveBeenCalledExactlyOnceWith('mock-user', userInfo);
    expect(failure).not.toHaveBeenCalled();
    expect(auth.getState().user).toMatchObject({ id: 'mock-user' });
    expect(requests.map((request) => request.path)).toEqual(['https://api.example/api/v1/auth/login']);
  });
  it('fails the callback when the login API rejects the token instead of restarting sign-in', async () => {
    const client = createInMemoryAuthClient();
    client.completeSignIn = async () => {
      await client.signIn({ intent: 'login', returnTo: '/dashboard' });
      return { ok: true, returnTo: '/dashboard' };
    };
    const api = createApiClient({
      baseUrl: 'https://api.example/api/v1',
      getAccessToken: client.getAccessToken,
      onUnauthorized: client.handleUnauthorized,
      fetchImpl: vi.fn(async () => new Response(null, { status: 401 })),
    });
    const failure = vi.fn();
    const auth = withAuthAudit(client, api, failure);

    expect(await auth.completeSignIn()).toEqual({
      ok: false,
      reason: 'failed',
      returnTo: '/dashboard',
    });
    expect(auth.getState().user).toBeNull();
    expect(failure).toHaveBeenCalledWith('login');
    expect(client.requests).toHaveLength(1);
  });

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
