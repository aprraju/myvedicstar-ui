import { type AuthConfig, entraIssuer, type IdentityProvider } from '@myvedicstar/config';
import {
  ErrorResponse,
  InMemoryWebStorage,
  type User,
  UserManager,
  WebStorageStateStore,
} from 'oidc-client-ts';

import type { AuthClient, AuthState, SignInCallbackResult } from './auth-client';

type OidcConfig = Extract<AuthConfig, { mode: 'oidc' }>;
type EntraConfig = Extract<AuthConfig, { mode: 'entra-external-id' }>;

/** Scopes every session needs: identity (`openid`, `profile`) and a refresh token for renewal without iframes. */
const BASE_SCOPES = ['openid', 'profile', 'email', 'offline_access'];
/** Renew the access token when it has less than this many seconds left. */
const RENEW_BEFORE_EXPIRY_SECONDS = 60;
const CANCELLED_ERRORS = new Set([
  'access_denied',
  'user_cancelled',
  'consent_required',
  'interaction_required',
]);

interface OidcClientSettings {
  /** OpenID Connect issuer; discovery is read from `<authority>/.well-known/openid-configuration`. */
  authority: string;
  clientId: string;
  scopes: readonly string[];
  redirectUri: string;
  postLogoutRedirectUri: string;
  tokenStorage: 'session' | 'memory';
  providers: readonly IdentityProvider[];
  providerParams: Partial<Record<IdentityProvider, Record<string, string>>>;
  registerParams: Record<string, string>;
}

/** Generic OpenID Connect provider (`auth.mode = "oidc"`); redirect paths are resolved against the app's origin. */
export function createOidcAuthClient(config: OidcConfig, origin: string): AuthClient {
  return createClient({
    authority: config.authority,
    clientId: config.clientId,
    scopes: config.scopes,
    redirectUri: new URL(config.redirectPath, origin).toString(),
    postLogoutRedirectUri: new URL(config.postLogoutRedirectPath, origin).toString(),
    tokenStorage: config.tokenStorage,
    providers: config.providers,
    providerParams: config.providerParams,
    registerParams: config.registerParams,
  });
}

/**
 * Microsoft Entra External ID (`auth.mode = "entra-external-id"`): full-page redirect to the Entra-hosted sign-in,
 * sign-up (`prompt=create`: email verification, password, attributes) and password-reset pages. Tokens are held in
 * memory only. (MSAL cannot combine a redirect flow with a memory-only cache, so the standards-based client is used;
 * Entra External ID is a compliant OpenID Connect provider — see docs/security/authentication.md.)
 */
export function createEntraAuthClient(config: EntraConfig): AuthClient {
  return createClient({
    authority: entraIssuer(config),
    clientId: config.clientId,
    scopes: config.apiScopes,
    redirectUri: config.redirectUri,
    postLogoutRedirectUri: config.postLogoutRedirectUri,
    tokenStorage: 'memory',
    providers: config.providers,
    providerParams: {},
    registerParams: { prompt: 'create' },
  });
}

/**
 * OpenID Connect client (authorization code + PKCE, public client) built on `oidc-client-ts`.
 *
 * - Tokens: memory or sessionStorage (tab-scoped), per settings — never localStorage or cookies.
 * - Transient redirect state (PKCE verifier, `state`, `returnTo`) lives in sessionStorage for one redirect only.
 * - Refresh tokens (`offline_access`): `getAccessToken()` redeems the refresh token at the token endpoint whenever the
 *   access token has expired or is about to, and a timer renews it shortly before expiry. No hidden iframes, so no
 *   `frame-src` CSP exception. A rejected refresh token ends the session.
 */
function createClient(settings: OidcClientSettings): AuthClient {
  const tabStorage = window.sessionStorage;
  const manager = new UserManager({
    authority: settings.authority,
    client_id: settings.clientId,
    redirect_uri: settings.redirectUri,
    post_logout_redirect_uri: settings.postLogoutRedirectUri,
    response_type: 'code',
    scope: [...new Set([...BASE_SCOPES, ...settings.scopes])].join(' '),
    userStore: new WebStorageStateStore({
      store: settings.tokenStorage === 'session' ? tabStorage : new InMemoryWebStorage(),
    }),
    stateStore: new WebStorageStateStore({ store: tabStorage }),
    automaticSilentRenew: true,
    accessTokenExpiringNotificationTimeInSeconds: RENEW_BEFORE_EXPIRY_SECONDS,
    monitorSession: false,
    loadUserInfo: false,
  });

  let state: AuthState = { status: 'loading', user: null };
  const listeners = new Set<() => void>();
  const publish = (user: User | null) => {
    state = { status: 'ready', user: user && !user.expired ? toAuthUser(user) : null };
    listeners.forEach((listener) => listener());
  };
  const endSession = async () => {
    await manager.removeUser();
    publish(null);
  };

  /** One refresh at a time: concurrent API calls share the same token request. */
  let refreshing: Promise<User | null> | null = null;
  const refresh = () =>
    (refreshing ??= manager
      .signinSilent() // with a refresh token this is the refresh_token grant (no iframe)
      .catch(async (error: unknown) => {
        if (error instanceof TypeError) return null; // offline: keep the session, the request fails normally
        await endSession(); // refresh token expired or revoked
        return null;
      })
      .finally(() => {
        refreshing = null;
      }));

  manager.events.addUserLoaded((user) => publish(user));
  manager.events.addUserUnloaded(() => publish(null));
  manager.events.addSilentRenewError(() => void endSession());
  void manager.getUser().then(publish, () => publish(null));

  return {
    enabled: true,
    providers: settings.providers,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async getAccessToken() {
      const user = await manager.getUser();
      if (!user) return null;
      const expiring = user.expired || (user.expires_in ?? 0) < RENEW_BEFORE_EXPIRY_SECONDS;
      if (!expiring) return user.access_token;
      if (!user.refresh_token) {
        if (user.expired) await endSession();
        return user.expired ? null : user.access_token;
      }
      const renewed = await refresh();
      return renewed && !renewed.expired ? renewed.access_token : null;
    },
    async signIn({ returnTo, intent, provider, loginHint }) {
      if (state.user) return;
      await manager.signinRedirect({
        state: { returnTo },
        ...(loginHint ? { login_hint: loginHint } : {}),
        extraQueryParams: {
          ...(provider ? settings.providerParams[provider] : {}),
          ...(intent === 'register' ? settings.registerParams : {}),
        },
      });
    },
    async completeSignIn(): Promise<SignInCallbackResult> {
      try {
        const user = await manager.signinRedirectCallback();
        publish(user);
        return { ok: true, returnTo: readReturnTo(user.state) };
      } catch (error) {
        const returnTo = error instanceof ErrorResponse ? readReturnTo(error.state) : undefined;
        if (error instanceof ErrorResponse && CANCELLED_ERRORS.has(error.error ?? '')) {
          return { ok: false, reason: 'cancelled', returnTo };
        }
        if (error instanceof TypeError) return { ok: false, reason: 'network', returnTo };
        return { ok: false, reason: 'failed', returnTo };
      }
    },
    async signOut() {
      const user = await manager.getUser();
      await endSession();
      // Ends the provider session too, then returns to the post-logout page.
      const logoutHint = user?.profile.login_hint;
      await manager.signoutRedirect({
        ...(user?.id_token ? { id_token_hint: user.id_token } : {}),
        ...(typeof logoutHint === 'string' && logoutHint
          ? { extraQueryParams: { logout_hint: logoutHint } }
          : {}),
      });
    },
    handleUnauthorized() {
      void endSession();
    },
  };
}

function toAuthUser(user: User) {
  const name = user.profile.name ?? user.profile.given_name;
  const emails = user.profile.emails;
  const email = [
    user.profile.email,
    ...(Array.isArray(emails) ? emails : []),
    user.profile.preferred_username,
  ].find((value): value is string => typeof value === 'string' && /^[^\s@]+@[^\s@]+$/.test(value.trim()));
  return {
    id: user.profile.sub,
    displayName: typeof name === 'string' ? name : undefined,
    ...(typeof email === 'string' && email.trim() ? { email: email.trim() } : {}),
  };
}

function readReturnTo(state: unknown): string | undefined {
  if (typeof state === 'object' && state !== null && 'returnTo' in state) {
    const value = (state as { returnTo: unknown }).returnTo;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}
