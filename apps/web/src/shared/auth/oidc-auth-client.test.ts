import { parseAppConfig } from '@myvedicstar/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class ErrorResponse extends Error {
    constructor(
      readonly error: string,
      readonly state?: unknown,
    ) {
      super(error);
    }
  }
  const manager = {
    settings: undefined as unknown,
    events: {
      addUserLoaded: vi.fn(),
      addUserUnloaded: vi.fn(),
      addSilentRenewError: vi.fn(),
    },
    getUser: vi.fn(),
    signinSilent: vi.fn(),
    signinRedirect: vi.fn(),
    signinRedirectCallback: vi.fn(),
    removeUser: vi.fn(),
    signoutRedirect: vi.fn(),
    clearStaleState: vi.fn(async () => undefined),
  };
  return { manager, ErrorResponse, replacePage: vi.fn() };
});

vi.mock('./page-navigation', () => ({ replacePage: mocks.replacePage }));

vi.mock('oidc-client-ts', () => ({
  ErrorResponse: mocks.ErrorResponse,
  InMemoryWebStorage: class {
    kind = 'memory';
  },

  WebStorageStateStore: class {
    constructor(readonly options: { store: unknown }) {}
  },
  // Returns the shared mock from `new UserManager(...)` so tests can inspect settings and calls.
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  UserManager: class {
    constructor(settings: unknown) {
      mocks.manager.settings = settings;
      return mocks.manager as never;
    }
  },
}));

import { createEntraAuthClient, createOidcAuthClient } from './oidc-auth-client';

const config = (() => {
  const result = parseAppConfig({
    environment: 'production',
    apiBaseUrl: 'https://api.example.com',
    auth: {
      mode: 'oidc',
      authority: 'https://tenant.ciamlogin.com/tenant.onmicrosoft.com',
      clientId: 'client-id',
      scopes: ['api://myvedicday/Panchang.Read'],
      providers: ['email', 'google'],
      providerParams: { google: { domain_hint: 'google.com' } },
    },
  });
  if (!result.ok || result.config.auth.mode !== 'oidc') throw new Error('bad test config');
  return result.config.auth;
})();

const user = (overrides = {}) => ({
  expired: false,
  access_token: 'access-123',
  id_token: 'id-123',
  profile: { sub: 'user-1', name: 'Asha' },
  state: { returnTo: '/good-time' },
  ...overrides,
});

describe('createOidcAuthClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manager.getUser.mockResolvedValue(null);
  });

  it('uses authorization code + PKCE settings with tab-scoped storage and refresh tokens', () => {
    createOidcAuthClient(config, 'https://www.myvedicstar.example');
    const settings = mocks.manager.settings as Record<string, unknown> & {
      userStore: { options: { store: unknown } };
      stateStore: { options: { store: unknown } };
    };
    expect(settings).toMatchObject({
      authority: config.authority,
      client_id: 'client-id',
      response_type: 'code',
      redirect_uri: 'https://www.myvedicstar.example/auth/callback',
      post_logout_redirect_uri: 'https://www.myvedicstar.example/',
      scope: 'openid profile email offline_access api://myvedicday/Panchang.Read',
      monitorSession: false,
    });
    expect(settings.userStore.options.store).toBe(window.sessionStorage);
    expect(settings.stateStore.options.store).toBe(window.sessionStorage);
    expect(settings.userStore.options.store).not.toBe(window.localStorage);
  });

  it('keeps tokens in memory when configured', () => {
    createOidcAuthClient({ ...config, tokenStorage: 'memory' }, 'https://x.example');
    const settings = mocks.manager.settings as { userStore: { options: { store: { kind?: string } } } };
    expect(settings.userStore.options.store.kind).toBe('memory');
  });

  it('restores a stored session and exposes only a minimal profile', async () => {
    mocks.manager.getUser.mockResolvedValue(user());
    const client = createOidcAuthClient(config, 'https://x.example');
    expect(client.getState().status).toBe('loading');
    await vi.waitFor(() =>
      expect(client.getState()).toEqual({ status: 'ready', user: { id: 'user-1', displayName: 'Asha' } }),
    );
    expect(await client.getAccessToken()).toBe('access-123');
  });

  it.each([
    { email: 'asha@example.com' },
    { emails: ['asha@example.com'] },
    { preferred_username: 'asha@example.com' },
  ])('retains an identity email for the profile menu: %j', async (claims) => {
    mocks.manager.getUser.mockResolvedValue(user({ profile: { sub: 'user-1', ...claims } }));
    const client = createOidcAuthClient(config, 'https://x.example');
    await vi.waitFor(() =>
      expect(client.getState().user).toMatchObject({ id: 'user-1', email: 'asha@example.com' }),
    );
  });

  it('treats an expired session as signed out', async () => {
    mocks.manager.getUser.mockResolvedValue(user({ expired: true }));
    const client = createOidcAuthClient(config, 'https://x.example');
    await vi.waitFor(() => expect(client.getState()).toEqual({ status: 'ready', user: null }));
    expect(await client.getAccessToken()).toBeNull();
  });

  it('passes the return path, login hint, provider hint and sign-up prompt', async () => {
    const client = createOidcAuthClient(config, 'https://x.example');
    await client.signIn({
      intent: 'register',
      provider: 'google',
      returnTo: '/good-time',
      loginHint: 'a@b.co',
    });
    expect(mocks.manager.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: '/good-time' },
      login_hint: 'a@b.co',
      extraQueryParams: { domain_hint: 'google.com', prompt: 'create' },
    });
  });

  it('completes the redirect and returns the stored destination', async () => {
    mocks.manager.signinRedirectCallback.mockResolvedValue(user());
    const client = createOidcAuthClient(config, 'https://x.example');
    expect(await client.completeSignIn()).toEqual({ ok: true, returnTo: '/good-time' });
    expect(client.getState().user?.id).toBe('user-1');
  });

  it.each([
    [new mocks.ErrorResponse('access_denied', { returnTo: '/dashboard' }), 'cancelled', '/dashboard'],
    [new TypeError('Failed to fetch'), 'network', undefined],
    [new mocks.ErrorResponse('invalid_grant'), 'failed', undefined],
  ])('maps callback failures (%s) to a reason code', async (error, reason, returnTo) => {
    mocks.manager.signinRedirectCallback.mockRejectedValue(error);
    const client = createOidcAuthClient(config, 'https://x.example');
    expect(await client.completeSignIn()).toEqual({ ok: false, reason, returnTo });
  });

  it('logs out silently: local session cleared, post-logout page, no provider page (even with an account hint)', async () => {
    mocks.manager.getUser.mockResolvedValue(user({ profile: { sub: 'user-1', login_hint: 'opaque-hint' } }));
    const client = createOidcAuthClient(config, 'https://x.example');
    await client.signOut();
    expect(mocks.manager.removeUser).toHaveBeenCalled();
    expect(mocks.manager.clearStaleState).toHaveBeenCalled();
    expect(client.getState().user).toBeNull();
    expect(mocks.manager.signoutRedirect).not.toHaveBeenCalled();
    const { post_logout_redirect_uri } = mocks.manager.settings as { post_logout_redirect_uri: string };
    expect(mocks.replacePage).toHaveBeenCalledWith(post_logout_redirect_uri);
  });
});

describe('refresh tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the cached access token while it is valid', async () => {
    mocks.manager.getUser.mockResolvedValue(user({ expires_in: 3000, refresh_token: 'rt' }));
    const client = createOidcAuthClient(config, 'https://x.example');
    expect(await client.getAccessToken()).toBe('access-123');
    expect(mocks.manager.signinSilent).not.toHaveBeenCalled();
  });

  it.each([
    ['expired', { expired: true, expires_in: -5 }],
    ['about to expire', { expires_in: 30 }],
  ])('redeems the refresh token when the access token is %s', async (_label, overrides) => {
    mocks.manager.getUser.mockResolvedValue(user({ ...overrides, refresh_token: 'rt' }));
    mocks.manager.signinSilent.mockResolvedValue(user({ access_token: 'renewed', expires_in: 3600 }));
    const client = createOidcAuthClient(config, 'https://x.example');
    expect(await client.getAccessToken()).toBe('renewed');
  });

  it('shares one refresh between concurrent requests', async () => {
    mocks.manager.getUser.mockResolvedValue(user({ expires_in: 10, refresh_token: 'rt' }));
    mocks.manager.signinSilent.mockResolvedValue(user({ access_token: 'renewed', expires_in: 3600 }));
    const client = createOidcAuthClient(config, 'https://x.example');
    const tokens = await Promise.all([
      client.getAccessToken(),
      client.getAccessToken(),
      client.getAccessToken(),
    ]);
    expect(tokens).toEqual(['renewed', 'renewed', 'renewed']);
    expect(mocks.manager.signinSilent).toHaveBeenCalledTimes(1);
  });

  it('ends the session when the refresh token is rejected', async () => {
    mocks.manager.getUser.mockResolvedValue(user({ expired: true, refresh_token: 'rt' }));
    mocks.manager.signinSilent.mockRejectedValue(new mocks.ErrorResponse('invalid_grant'));
    const client = createOidcAuthClient(config, 'https://x.example');
    expect(await client.getAccessToken()).toBeNull();
    expect(mocks.manager.removeUser).toHaveBeenCalled();
    expect(client.getState().user).toBeNull();
    expect(client.getState().signInError).toBe('failed');
  });

  it('blocks automatic reauthentication and tokens immediately when an API rejects the session', async () => {
    mocks.manager.getUser.mockResolvedValue(user());
    let finishCleanup!: () => void;
    mocks.manager.removeUser.mockImplementation(
      () => new Promise<void>((resolve) => (finishCleanup = resolve)),
    );
    const client = createOidcAuthClient(config, 'https://x.example');
    await vi.waitFor(() => expect(client.getState().user).not.toBeNull());
    client.handleUnauthorized();
    expect(client.getState()).toEqual({ status: 'ready', user: null, signInError: 'failed' });
    expect(await client.getAccessToken()).toBeNull();
    expect(mocks.manager.signinRedirect).not.toHaveBeenCalled();
    finishCleanup();
    mocks.manager.removeUser.mockResolvedValue(undefined);
    await vi.waitFor(() => expect(client.getState().signInError).toBe('failed'));
    await client.signIn({ intent: 'login', returnTo: '/dashboard' });
    expect(client.getState().signInError).toBeUndefined();
    expect(mocks.manager.signinRedirect).toHaveBeenCalledOnce();
  });

  it('keeps the session when the refresh fails because the device is offline', async () => {
    mocks.manager.getUser.mockResolvedValue(user({ expired: true, refresh_token: 'rt' }));
    mocks.manager.signinSilent.mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createOidcAuthClient(config, 'https://x.example');
    expect(await client.getAccessToken()).toBeNull();
    expect(mocks.manager.removeUser).not.toHaveBeenCalled();
  });
});

describe('createEntraAuthClient (Microsoft Entra External ID)', () => {
  const entra = (() => {
    const result = parseAppConfig({
      environment: 'development',
      apiBaseUrl: 'http://localhost:5275/api/v1',
      auth: {
        mode: 'entra-external-id',
        authority: 'https://myvedicstar.ciamlogin.com/',
        tenantId: 'tenant-id',
        clientId: 'web-client-id',
        apiScopes: ['api://api-client-id/access_as_user'],
        redirectUri: 'http://localhost:5173/auth/callback',
        postLogoutRedirectUri: 'http://localhost:5173/',
      },
    });
    if (!result.ok || result.config.auth.mode !== 'entra-external-id') throw new Error('bad test config');
    return result.config.auth;
  })();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manager.getUser.mockResolvedValue(null);
  });

  it('uses the tenant issuer, exact redirect URIs, the API scope and tab-scoped token storage', () => {
    createEntraAuthClient(entra);
    const settings = mocks.manager.settings as Record<string, unknown> & {
      userStore: { options: { store: { kind?: string } } };
      stateStore: { options: { store: unknown } };
    };
    expect(settings).toMatchObject({
      authority: 'https://myvedicstar.ciamlogin.com/tenant-id/v2.0',
      client_id: 'web-client-id',
      response_type: 'code',
      redirect_uri: 'http://localhost:5173/auth/callback',
      post_logout_redirect_uri: 'http://localhost:5173/',
      scope: 'openid profile email offline_access api://api-client-id/access_as_user',
      automaticSilentRenew: true,
    });
    // Tokens in sessionStorage so a page refresh keeps the session; never localStorage.
    expect(settings.userStore.options.store).toBe(window.sessionStorage);
    expect(settings.stateStore.options.store).toBe(window.sessionStorage);
  });

  it('stays signed in after a page refresh', async () => {
    mocks.manager.getUser.mockResolvedValue(user());
    const client = createEntraAuthClient(entra);
    await vi.waitFor(() =>
      expect(client.getState()).toMatchObject({ status: 'ready', user: { id: 'user-1' } }),
    );
    expect(mocks.manager.signinSilent).not.toHaveBeenCalled();
  });

  it('renews an expired access token restored after a refresh instead of signing out', async () => {
    mocks.manager.getUser.mockResolvedValue(user({ expired: true, refresh_token: 'refresh-1' }));
    mocks.manager.signinSilent.mockResolvedValue(user({ access_token: 'access-2' }));
    const client = createEntraAuthClient(entra);
    await vi.waitFor(() =>
      expect(client.getState()).toMatchObject({ status: 'ready', user: { id: 'user-1' } }),
    );
    expect(mocks.manager.signinSilent).toHaveBeenCalledOnce();
    expect(client.getState().signInError).toBeUndefined();
  });

  it('drops a restored session quietly when its refresh token has expired', async () => {
    mocks.manager.getUser.mockResolvedValue(user({ expired: true, refresh_token: 'refresh-1' }));
    mocks.manager.signinSilent.mockRejectedValue(new Error('invalid_grant'));
    const client = createEntraAuthClient(entra);
    await vi.waitFor(() => expect(client.getState().status).toBe('ready'));
    expect(client.getState()).toEqual({ status: 'ready', user: null });
    expect(mocks.manager.removeUser).toHaveBeenCalled();
  });

  it('opens the Entra sign-up page for Register', async () => {
    const client = createEntraAuthClient(entra);
    await client.signIn({ intent: 'register', returnTo: '/dashboard' });
    expect(mocks.manager.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: '/dashboard' },
      extraQueryParams: { prompt: 'create' },
    });
  });

  it('logs out of Entra silently, without an end-session page', async () => {
    const client = createEntraAuthClient(entra);
    await client.signOut();
    expect(mocks.manager.signoutRedirect).not.toHaveBeenCalled();
    expect(mocks.replacePage).toHaveBeenCalledWith(entra.postLogoutRedirectUri);
  });
});

describe('sign-in after Logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.manager.getUser.mockResolvedValue(null);
  });

  it('asks for credentials (prompt=login) until a sign-in succeeds', async () => {
    mocks.manager.getUser.mockResolvedValue(user());
    const client = createOidcAuthClient(config, 'https://x.example');
    await client.signOut();
    mocks.manager.getUser.mockResolvedValue(null);

    await client.signIn({ intent: 'login', returnTo: '/calendar' });
    expect(mocks.manager.signinRedirect).toHaveBeenLastCalledWith({
      state: { returnTo: '/calendar' },
      extraQueryParams: { prompt: 'login' },
    });
    // A cancelled attempt still asks next time.
    await client.signIn({ intent: 'login', returnTo: '/calendar' });
    expect(mocks.manager.signinRedirect).toHaveBeenLastCalledWith(
      expect.objectContaining({ extraQueryParams: { prompt: 'login' } }),
    );

    mocks.manager.signinRedirectCallback.mockResolvedValue(user({ state: { returnTo: '/calendar' } }));
    await client.completeSignIn();
    // A later visit (new page load, signed out) signs in normally again.
    mocks.manager.getUser.mockResolvedValue(null);
    const later = createOidcAuthClient(config, 'https://x.example');
    await later.signIn({ intent: 'login', returnTo: '/calendar' });
    expect(mocks.manager.signinRedirect).toHaveBeenLastCalledWith({
      state: { returnTo: '/calendar' },
      extraQueryParams: {},
    });
  });

  it('keeps the sign-up page for Register after Logout', async () => {
    const client = createOidcAuthClient(config, 'https://x.example');
    await client.signOut();
    await client.signIn({ intent: 'register', returnTo: '/calendar' });
    expect(mocks.manager.signinRedirect).toHaveBeenLastCalledWith(
      expect.objectContaining({ extraQueryParams: expect.not.objectContaining({ prompt: 'login' }) }),
    );
  });
});
