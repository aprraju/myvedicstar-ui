import type { AuthConfig, IdentityProvider } from '@myvedicstar/config';

/** Minimal, non-sensitive profile of the signed-in user. Tokens are never part of it. */
export interface AuthUser {
  id: string;
  displayName?: string | undefined;
  email?: string | undefined;
}

/** `loading` while a stored session is being restored (e.g. after a page reload). */
export interface AuthState {
  status: 'loading' | 'ready';
  user: AuthUser | null;
}

export interface SignInRequest {
  /** Sanitized in-app path to return to after the identity provider redirects back. */
  returnTo: string;
  intent: 'login' | 'register';
  provider?: IdentityProvider | undefined;
  /** Optional email passed to the provider as `login_hint`. */
  loginHint?: string | undefined;
}

export type SignInCallbackResult =
  | { ok: true; returnTo: string | undefined }
  | { ok: false; reason: 'cancelled' | 'network' | 'failed'; returnTo: string | undefined };

/**
 * The UI's only view of authentication. Implementations wrap a standards-based OIDC library (authorization code +
 * PKCE). Components use `useAuth()`; the API client asks for tokens through `getAccessToken()`.
 * Tokens are never logged and never written to localStorage.
 */
export interface AuthClient {
  readonly enabled: boolean;
  /** Identity providers enabled by configuration; only these are offered on Login/Register. */
  readonly providers: readonly IdentityProvider[];
  getState(): AuthState;
  subscribe(listener: () => void): () => void;
  getAccessToken(): Promise<string | null>;
  /** Starts sign-in. OIDC implementations navigate away to the identity provider. */
  signIn(request: SignInRequest): Promise<void>;
  /** Completes the redirect back from the identity provider (the `/auth/callback` route). */
  completeSignIn(): Promise<SignInCallbackResult>;
  signOut(): Promise<void>;
  /** The API rejected our token: forget the local session so the UI shows the signed-out state. */
  handleUnauthorized(): void;
}

const READY_SIGNED_OUT: AuthState = { status: 'ready', user: null };

/** Used when `auth.mode` is `disabled`: the public experience works; Login/Register are hidden. */
export function createDisabledAuthClient(): AuthClient {
  return {
    enabled: false,
    providers: [],
    getState: () => READY_SIGNED_OUT,
    subscribe: () => () => undefined,
    getAccessToken: async () => null,
    signIn: async () => undefined,
    completeSignIn: async () => ({ ok: false, reason: 'failed', returnTo: undefined }),
    signOut: async () => undefined,
    handleUnauthorized: () => undefined,
  };
}

/**
 * In-memory client: `auth.mode = "mock"` (local development and automated tests only — enforced by the config schema)
 * and unit tests. Signs in instantly; no identity provider, no tokens of value.
 */
export function createInMemoryAuthClient(
  options: { providers?: readonly IdentityProvider[]; user?: AuthUser | null } = {},
): AuthClient & { requests: SignInRequest[] } {
  let state: AuthState = { status: 'ready', user: options.user ?? null };
  const listeners = new Set<() => void>();
  const set = (user: AuthUser | null) => {
    state = { status: 'ready', user };
    listeners.forEach((listener) => listener());
  };
  const requests: SignInRequest[] = [];

  return {
    enabled: true,
    providers: options.providers ?? ['email', 'google'],
    requests,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getAccessToken: async () => (state.user ? 'mock-access-token' : null),
    signIn: async (request) => {
      requests.push(request);
      set({ id: 'mock-user', displayName: 'Test User' });
    },
    completeSignIn: async () => ({ ok: true, returnTo: undefined }),
    signOut: async () => set(null),
    handleUnauthorized: () => set(null),
  };
}

/**
 * Creates the client for the configured mode. Identity libraries are separate, lazily loaded chunks:
 * `entra-external-id` and `oidc` → oidc-client-ts (Entra: memory-only tokens, issuer derived from the tenant).
 */
export function createAuthClient(config: AuthConfig): AuthClient {
  switch (config.mode) {
    case 'disabled':
      return createDisabledAuthClient();
    case 'mock':
      return createInMemoryAuthClient({ providers: config.providers });
    case 'entra-external-id':
      return createLazyAuthClient(
        config.providers,
        import('./oidc-auth-client').then(({ createEntraAuthClient }) => createEntraAuthClient(config)),
      );
    case 'oidc':
      return createLazyAuthClient(
        config.providers,
        import('./oidc-auth-client').then(({ createOidcAuthClient }) =>
          createOidcAuthClient(config, window.location.origin),
        ),
      );
  }
}

/**
 * Wraps a lazily created client so the identity library (and its code) is downloaded only when authentication is
 * configured, and the rest of the app can use a synchronous client immediately.
 */
function createLazyAuthClient(
  providers: readonly IdentityProvider[],
  pending: Promise<AuthClient>,
): AuthClient {
  let state: AuthState = { status: 'loading', user: null };
  const listeners = new Set<() => void>();
  const loaded = pending.then((client) => {
    client.subscribe(() => {
      state = client.getState();
      listeners.forEach((listener) => listener());
    });
    state = client.getState();
    listeners.forEach((listener) => listener());
    return client;
  });

  return {
    enabled: true,
    providers,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getAccessToken: async () => (await loaded).getAccessToken(),
    signIn: async (request) => (await loaded).signIn(request),
    completeSignIn: async () => (await loaded).completeSignIn(),
    signOut: async () => (await loaded).signOut(),
    handleUnauthorized: () => void loaded.then((client) => client.handleUnauthorized()),
  };
}
