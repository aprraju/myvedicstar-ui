import { type AuthConfig, entraIssuer, type IdentityProvider } from '@myvedicstar/config';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';

export interface AuthUser {
  id: string;
  displayName?: string | undefined;
}

export interface AuthState {
  status: 'loading' | 'ready';
  user: AuthUser | null;
}

export interface SignInRequest {
  intent: 'login' | 'register';
  provider?: IdentityProvider | undefined;
  loginHint?: string | undefined;
}

export class SignInCancelled extends Error {
  constructor() {
    super('Sign-in cancelled');
    this.name = 'SignInCancelled';
  }
}

/**
 * Mobile authentication boundary. The OIDC implementation uses the system browser (authorization code + PKCE via
 * expo-auth-session) and keeps tokens only in expo-secure-store (iOS Keychain / Android Keystore) — never in
 * AsyncStorage, never logged.
 */
export interface AuthClient {
  readonly enabled: boolean;
  readonly providers: readonly IdentityProvider[];
  getState(): AuthState;
  subscribe(listener: () => void): () => void;
  getAccessToken(): Promise<string | null>;
  /** Resolves when signed in; rejects with SignInCancelled if the user closes the browser. */
  signIn(request: SignInRequest): Promise<void>;
  signOut(): Promise<void>;
  handleUnauthorized(): void;
}

function createStore(initial: AuthState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: AuthState) {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createDisabledAuthClient(): AuthClient {
  const state: AuthState = { status: 'ready', user: null };
  return {
    enabled: false,
    providers: [],
    getState: () => state,
    subscribe: () => () => undefined,
    getAccessToken: async () => null,
    signIn: async () => undefined,
    signOut: async () => undefined,
    handleUnauthorized: () => undefined,
  };
}

/** `auth.mode = "mock"` (local/test only, enforced by the config schema) and unit tests. */
export function createInMemoryAuthClient(
  options: { providers?: readonly IdentityProvider[]; user?: AuthUser | null } = {},
): AuthClient & { requests: SignInRequest[] } {
  const store = createStore({ status: 'ready', user: options.user ?? null });
  const requests: SignInRequest[] = [];
  return {
    enabled: true,
    providers: options.providers ?? ['email', 'google'],
    requests,
    getState: store.get,
    subscribe: store.subscribe,
    getAccessToken: async () => (store.get().user ? 'mock-access-token' : null),
    signIn: async (request) => {
      requests.push(request);
      store.set({ status: 'ready', user: { id: 'mock-user', displayName: 'Test User' } });
    },
    signOut: async () => store.set({ status: 'ready', user: null }),
    handleUnauthorized: () => store.set({ status: 'ready', user: null }),
  };
}

export function createAuthClient(config: AuthConfig): AuthClient {
  switch (config.mode) {
    case 'disabled':
      return createDisabledAuthClient();
    case 'mock':
      return createInMemoryAuthClient({ providers: config.providers });
    case 'oidc':
      return createExpoOidcAuthClient(config);
    case 'entra-external-id':
      // Entra External ID is a standard OpenID Connect provider (and Microsoft ships no MSAL for React Native/Expo),
      // so the same system-browser PKCE client is used against its issuer (see
      // docs/security/authentication.md). Configure the MyVedicStar-Mobile client ID, not the web one.
      return createExpoOidcAuthClient({
        mode: 'oidc',
        authority: entraIssuer(config),
        clientId: config.clientId,
        scopes: config.apiScopes,
        redirectPath: '/auth/callback',
        postLogoutRedirectPath: '/',
        providers: config.providers,
        tokenStorage: 'session',
        providerParams: {},
        registerParams: { prompt: 'create' },
      });
  }
}

const TOKEN_KEY = 'mvs.auth.tokens';
const BASE_SCOPES = ['openid', 'profile', 'offline_access'];

type OidcConfig = Extract<AuthConfig, { mode: 'oidc' }>;

/** OIDC (authorization code + PKCE) with the system browser; tokens in secure storage; refresh-token renewal. */
export function createExpoOidcAuthClient(config: OidcConfig): AuthClient {
  const store = createStore({ status: 'loading', user: null });
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'myvedicstar', path: 'auth/callback' });
  const scopes = [...new Set([...BASE_SCOPES, ...config.scopes])];
  let discovery: AuthSession.DiscoveryDocument | null = null;
  let tokens: AuthSession.TokenResponse | null = null;

  const getDiscovery = async () => (discovery ??= await AuthSession.fetchDiscoveryAsync(config.authority));

  const save = async (next: AuthSession.TokenResponse | null) => {
    tokens = next;
    if (next) {
      await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(next.getRequestConfig()), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    store.set({ status: 'ready', user: next ? userFromIdToken(next.idToken) : null });
  };

  void (async () => {
    try {
      const raw = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!raw) return store.set({ status: 'ready', user: null });
      tokens = new AuthSession.TokenResponse(JSON.parse(raw) as AuthSession.TokenResponseConfig);
      store.set({ status: 'ready', user: userFromIdToken(tokens.idToken) });
    } catch {
      await save(null);
    }
  })();

  return {
    enabled: true,
    providers: config.providers,
    getState: store.get,
    subscribe: store.subscribe,
    async getAccessToken() {
      if (!tokens) return null;
      if (!tokens.shouldRefresh()) return tokens.accessToken;
      if (!tokens.refreshToken) {
        await save(null);
        return null;
      }
      try {
        const refreshed = await tokens.refreshAsync(
          { clientId: config.clientId, scopes },
          await getDiscovery(),
        );
        await save(refreshed);
        return refreshed.accessToken;
      } catch {
        await save(null);
        return null;
      }
    },
    async signIn({ intent, provider, loginHint }) {
      const request = new AuthSession.AuthRequest({
        clientId: config.clientId,
        redirectUri,
        scopes,
        usePKCE: true,
        responseType: AuthSession.ResponseType.Code,
        extraParams: {
          ...(provider ? config.providerParams[provider] : {}),
          ...(intent === 'register' ? config.registerParams : {}),
          ...(loginHint ? { login_hint: loginHint } : {}),
        },
      });
      const result = await request.promptAsync(await getDiscovery());
      if (result.type === 'cancel' || result.type === 'dismiss') throw new SignInCancelled();
      if (result.type !== 'success' || !request.codeVerifier) throw new Error('Sign-in failed');
      const exchanged = await AuthSession.exchangeCodeAsync(
        {
          clientId: config.clientId,
          code: result.params.code ?? '',
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier },
        },
        await getDiscovery(),
      );
      await save(exchanged);
    },
    async signOut() {
      const current = tokens;
      await save(null);
      const revocationEndpoint = discovery?.revocationEndpoint;
      if (current?.refreshToken && revocationEndpoint) {
        await AuthSession.revokeAsync(
          { clientId: config.clientId, token: current.refreshToken },
          { revocationEndpoint },
        ).catch(() => undefined);
      }
    },
    handleUnauthorized() {
      void save(null);
    },
  };
}

/** Display name and subject from the ID token payload (already validated by the token endpoint over TLS). */
export function userFromIdToken(idToken: string | undefined): AuthUser | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split('.')[1] ?? '';
    const json = JSON.parse(globalThis.atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as Record<
      string,
      unknown
    >;
    const name = json.name ?? json.given_name;
    return typeof json.sub === 'string'
      ? { id: json.sub, displayName: typeof name === 'string' ? name : undefined }
      : null;
  } catch {
    return null;
  }
}
