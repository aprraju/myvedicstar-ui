# Authentication

## Architecture

Per the backend plan, **Microsoft Entra External ID (CIAM)** is the single token issuer; Google, Apple, Facebook and
email accounts are federated inside External ID user flows. Clients never handle raw Google/Apple/Facebook tokens.
The frontends are standards-based and provider-neutral: any OpenID Connect provider works by configuration.

```text
Web SPA ── OIDC authorization code + PKCE (public client, redirect) ──┐
Mobile  ── OIDC authorization code + PKCE (system browser)  ──────────┤──► Entra External ID
                                                                       │    (email, Google, Apple, Facebook)
        ◄──────────── access token (JWT) + refresh token ─────────────┘
        ── Authorization: Bearer <access token> ──► MyVedicDay API (validates, authorizes)
```

- Public clients only: **no client secret exists anywhere in the frontend.**
- Passwords are entered only on the identity provider's pages (browser / system browser), never in the app.
- The email field on Login/Register is only a `login_hint` for the provider.

## Microsoft Entra External ID (`auth.mode = "entra-external-id"`)

The primary configuration. Setup and the Entra → config field mapping: [entra-setup.md](entra-setup.md).

| Platform      | Library                                                                                                         | Notes                                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web           | **`oidc-client-ts`** (`createEntraAuthClient` in `apps/web/src/shared/auth/oidc-auth-client.ts`, loaded lazily) | Full-page redirect, authorization code + PKCE, public client, tokens in sessionStorage. Issuer: `entraIssuer()` → `https://<sub>.ciamlogin.com/<tenant>/v2.0`. |
| Android / iOS | `expo-auth-session` + `expo-secure-store`                                                                       | System browser, PKCE, same issuer; tokens in Keychain / Keystore.                                                                                              |

**Why not MSAL (`@azure/msal-browser`)?** It was ruled out when tokens had to be held in memory only: MSAL refuses a
redirect sign-in with a memory cache (`in_mem_redirect_unavailable`), and its only memory-compatible option is a popup
window. Tokens now live in sessionStorage (see below) and `oidc-client-ts` remains the client, keeping the provider
configurable and the bundle small. Entra External ID is a standard OpenID
Connect provider and works with it unchanged. Microsoft also ships no MSAL for React Native/Expo.

### Flows

```text
Login / Register buttons (header, Get Started)  ──►  Entra-hosted page (full-page redirect)
   Register = prompt=create: email verification → password → given name, surname, location
   Forgot password: link on the Entra sign-in page (email OTP → new password) — no app or backend endpoint
                  ◄── /auth/callback (code + PKCE verifier exchanged at the token endpoint) ──► validated returnTo
Protected route while signed out  ──►  straight to Entra, then back to the requested route (default /dashboard)
Logout  ──►  local session cleared (silent: no Entra page)  ──►  postLogoutRedirectUri
Next Login after Logout  ──►  Entra with prompt=login (credentials asked again)
```

- Logout is local and silent: tokens are removed from sessionStorage and the post-logout page replaces the current one. The
  app does not visit Entra's end-session endpoint, which always shows a page of its own ("Pick an account" without a
  `logout_hint`, "Hang on a moment while we sign you out" with one).
- The Entra browser session therefore remains, so Logout sets a flag (`mvs.auth.reauthenticate` in localStorage — no
  token or identity) and the next sign-in sends `prompt=login`: Entra asks for credentials instead of signing the
  previous account in silently. The flag is cleared only by a successful sign-in, so cancelling still asks next time.
  Register keeps `prompt=create`.

- There are no in-app login or register pages. Sign-in errors (`?error=cancelled|network|failed` on
  `/auth/callback`) show a friendly message with "Try again" and "Home", so a failure never loops.
- No email or password field is shown in Entra mode; passwords are only ever typed on Entra's pages.

### Tokens: tab-scoped sessionStorage, refresh tokens for renewal

- Access, ID and refresh tokens are kept in **sessionStorage** — never localStorage or cookies. Not configurable in
  Entra mode. A page refresh keeps the user signed in until they press Log out; closing the tab ends the session.
  (They were memory-only until 2026-10-16, which signed users out on every refresh.)
- Only the transient redirect record (PKCE verifier, `state` with the `returnTo` path, nonce) sits in sessionStorage
  between leaving for Entra and returning to `/auth/callback`; it is removed when the callback completes.
- **Refresh tokens:** `offline_access` is always requested. `getAccessToken()` returns the stored access token
  while it has more than 60 seconds left; otherwise it redeems the refresh token at the token endpoint
  (`refresh_token` grant) and uses the new pair. Concurrent API calls share one refresh, and a timer also renews
  shortly before expiry. No hidden iframe is used, so CSP keeps `frame-src 'none'`. (Entra issues SPA refresh tokens
  valid for 24 hours.)
- Refresh token rejected (expired or revoked): the session ends and the next protected page sends the user to Entra.
  Offline: the session is kept and the request fails normally.
- A reload restores the stored session. If its access token has expired it is renewed with the refresh token first;
  if the refresh token has expired too, the stored session is dropped quietly and protected pages sign in again.
- A new tab has its own (empty) sessionStorage. Protected routes then redirect to Entra, whose own session cookie
  usually signs the user straight back in without a prompt.
- A 401 from the API clears the stored session (`handleUnauthorized`).

## Libraries (Phase 2 decision; `auth.mode = "oidc"`)

| Platform | Library                                               | Why                                                                                                                                                                                                                                                                                                                          |
| -------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web      | **`oidc-client-ts` 3.5** (Apache-2.0, one dependency) | Standards-based OIDC/PKCE, provider-neutral (Entra External ID or any other), no `eval`, ~15 kB gzip, loaded **lazily** only when `auth.mode = "oidc"`. Chosen over `@azure/msal-browser` to keep the provider configurable and the bundle small; MSAL remains a drop-in alternative behind the same `AuthClient` interface. |
| Mobile   | **`expo-auth-session`** + **`expo-secure-store`**     | Expo-supported OIDC with PKCE in the system browser (`ASWebAuthenticationSession` / Custom Tabs); tokens in Keychain / Keystore.                                                                                                                                                                                             |

## Token handling

| Platform      | Tokens stored in                                           | Notes                                                                                                                                                                                       |
| ------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web           | `sessionStorage` (default) or memory — `auth.tokenStorage` | Tab-scoped; cleared when the tab closes; **never localStorage**. `memory` is stricter but loses the session on reload. Redirect state (PKCE verifier, `returnTo`) always in sessionStorage. |
| Android / iOS | `expo-secure-store`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` | Never AsyncStorage; not included in backups/transfers to other devices.                                                                                                                     |

- Renewal uses **refresh tokens** (`offline_access` is always requested), so the web needs no hidden iframes and no
  `frame-src` CSP exception.
- A 401 from the API clears the local session (`handleUnauthorized`), returning the UI to the signed-out state.
- Never log or send to telemetry: access/refresh/ID tokens, `Authorization` headers, cookies, passwords,
  authorization codes, PKCE verifiers. Telemetry redaction enforces known key names and token patterns as a backstop.

## Code

| Piece                                                                                            | Web                                                                                                                               | Mobile                                          |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Interface (`getState`, `subscribe`, `getAccessToken`, `signIn`, `signOut`, `handleUnauthorized`) | `apps/web/src/shared/auth/auth-client.ts`                                                                                         | `apps/mobile/src/shared/auth/auth-client.ts`    |
| OIDC implementation                                                                              | `oidc-auth-client.ts` (lazy chunk)                                                                                                | `createExpoOidcAuthClient`                      |
| `auth.mode = "disabled"`                                                                         | public experience works; Login explains sign-in is unavailable                                                                    | same                                            |
| `auth.mode = "mock"`                                                                             | instant sign-in; **allowed only in `local`/`test` environments** (config schema) — used by E2E                                    | same                                            |
| Route guard                                                                                      | `ProtectedRoute` waits while a session is restored, then starts sign-in at the provider (`returnTo` kept)                         | Find a Good Time → `/login?returnTo=/good-time` |
| Callback                                                                                         | `/auth/callback` → validated `returnTo`; failures → `/auth/callback?error=cancelled\|network\|failed` (codes only) with Try again | handled in-process by `promptAsync`             |

## Configuration (`config.json` → `auth`; mobile: `EXPO_PUBLIC_AUTH`)

```json
{
  "mode": "oidc",
  "authority": "https://<tenant>.ciamlogin.com/<tenant>.onmicrosoft.com",
  "clientId": "<public client id>",
  "scopes": ["api://<api-app-id>/Panchang.Read"],
  "redirectPath": "/auth/callback",
  "postLogoutRedirectPath": "/",
  "providers": ["email", "google", "apple", "facebook"],
  "tokenStorage": "session",
  "providerParams": { "google": { "domain_hint": "google.com" } },
  "registerParams": { "prompt": "create" }
}
```

- `providers` controls which buttons appear; nothing else is shown.
- `providerParams` are extra authorization-request parameters that take the user straight to a federated provider
  (confirm the exact hint values supported by your External ID tenant; without them the provider's own chooser is
  shown). `registerParams` defaults to OIDC `prompt=create` (sign-up page).
- App registration redirect URIs: `https://<web origin>/auth/callback` (SPA platform) and
  `myvedicstar://auth/callback` (mobile/public client).
- CSP: add the authority origin to `connect-src` (discovery and token endpoints) — deployment does it automatically (`externalOrigins()` in `packages/config`).

## Return path safety

The web app attempts `POST /api/v1/auth/login` once when an account session starts and awaits
`POST /api/v1/auth/logout` before clearing the session and redirecting to the provider. Both requests
use the active account's bearer token and an empty JSON body. Failed audit requests are reported as
`auth.auditFailed` metrics without blocking sign-out; they are not retried automatically.
The login response carries the user's ID, display name, email and names; it is seeded into the query cache before
the account is published, so there is no separate user-info request (`/auth/userinfo` duplicates `/auth/login` on the
backend, including its database write, and is not called).

The app holds one active account and ignores additional sign-in requests while signed in. Entra
logout sends the ID token and the token's optional `login_hint` claim as `logout_hint`. Configure
the `login_hint` optional ID-token claim on the Entra client app registration to suppress the
provider's account selection prompt, as described in
[Microsoft's logout guidance](https://learn.microsoft.com/en-us/troubleshoot/entra/entra-id/app-integration/sign-out-of-openid-connect-oauth2-applications-without-user-selection-prompt).

`returnTo` is accepted only as a same-origin relative path (`sanitizeReturnPath`: rejects absolute URLs, `//`,
backslashes, schemes and control characters). It is validated before starting sign-in **and** again after the
provider redirects back.
