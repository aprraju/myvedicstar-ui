import { parseAppConfig } from '@myvedicstar/config';
import { describe, expect, it, vi } from 'vitest';

import { createAuthClient, createDisabledAuthClient, createInMemoryAuthClient } from './auth-client';

function authConfig(auth: unknown) {
  const result = parseAppConfig({ environment: 'test', apiBaseUrl: 'http://localhost:5275/api/v1', auth });
  if (!result.ok) throw new Error(result.issues.join('\n'));
  return result.config.auth;
}

describe('createAuthClient', () => {
  it('disables sign-in when auth.mode is "disabled": signed out, no providers, no token', async () => {
    const client = createAuthClient(authConfig({ mode: 'disabled' }));
    expect(client.enabled).toBe(false);
    expect(client.providers).toEqual([]);
    expect(client.getState()).toEqual({ status: 'ready', user: null });
    expect(await client.getAccessToken()).toBeNull();
    expect(await client.completeSignIn()).toEqual({ ok: false, reason: 'failed', returnTo: undefined });
  });

  it('uses the in-memory client for auth.mode "mock" with the configured providers', () => {
    const client = createAuthClient(authConfig({ mode: 'mock', providers: ['email'] }));
    expect(client.enabled).toBe(true);
    expect(client.providers).toEqual(['email']);
  });

  it('loads the Entra External ID client lazily and starts in the loading state', async () => {
    const client = createAuthClient(
      authConfig({
        mode: 'entra-external-id',
        authority: 'https://mvs.ciamlogin.com/',
        tenantId: '11111111-2222-3333-4444-555555555555',
        clientId: 'web-client',
        apiScopes: ['api://api/access_as_user'],
        redirectUri: 'http://localhost:5173/auth/callback',
        postLogoutRedirectUri: 'http://localhost:5173/',
      }),
    );
    expect(client.enabled).toBe(true);
    expect(client.providers).toEqual(['email']);
    expect(client.getState().status).toBe('loading');
    // No stored session in tests: once the identity library has loaded, the user is signed out and has no token.
    expect(await client.getAccessToken()).toBeNull();
    await vi.waitFor(() => expect(client.getState()).toEqual({ status: 'ready', user: null }));
  });
});

describe('createDisabledAuthClient', () => {
  it('ignores sign-in, sign-out and 401s without throwing', async () => {
    const client = createDisabledAuthClient();
    const listener = vi.fn();
    client.subscribe(listener)();
    await client.signIn({ intent: 'login', returnTo: '/dashboard' });
    await client.signOut();
    client.handleUnauthorized();
    expect(client.getState().user).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createInMemoryAuthClient', () => {
  it('signs in and out, notifies subscribers and only hands out a token while signed in', async () => {
    const client = createInMemoryAuthClient();
    const listener = vi.fn();
    const unsubscribe = client.subscribe(listener);

    expect(await client.getAccessToken()).toBeNull();
    await client.signIn({ intent: 'register', returnTo: '/good-time', provider: 'google' });
    expect(client.requests).toEqual([{ intent: 'register', returnTo: '/good-time', provider: 'google' }]);
    expect(client.getState().user).toEqual({ id: 'mock-user', displayName: 'Test User' });
    expect(await client.getAccessToken()).toBe('mock-access-token');

    client.handleUnauthorized(); // the API rejected the token: forget the session
    expect(client.getState().user).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    await client.signIn({ intent: 'login', returnTo: '/' });
    await client.signOut();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
