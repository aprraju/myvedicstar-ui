# Microsoft Entra External ID setup

How to create the app registrations and copy their values into the web runtime config
(`infrastructure/web/config/config.<environment>.json` → `auth`) and the mobile build (`EXPO_PUBLIC_AUTH`).
Everything listed here is **public client configuration**; no secret is ever needed by the web or mobile apps.

## 1. App registrations (external tenant)

| Registration         | Platform                            | Redirect URIs                                                                                    | Notes                                                                             |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `MyVedicStar-API`    | none                                | —                                                                                                | Expose an API: Application ID URI `api://<api-client-id>`, scope `access_as_user` |
| `MyVedicStar-Web`    | **Single-page application**         | `https://localhost:5173/auth/callback` (DEV), `https://www.myvedicstar.com/auth/callback` (PROD) | API permissions: `MyVedicStar-API / access_as_user` (grant admin consent)         |
| `MyVedicStar-Mobile` | **Mobile and desktop applications** | `myvedicstar://auth/callback`                                                                    | Same API permission. Allow public client flows: not required (auth code + PKCE)   |

- Front-channel logout URL / post-logout redirect: `https://localhost:5173/` and `https://www.myvedicstar.com/`.
- **User flow** (External Identities → User flows): one _Sign up and sign in_ flow with Email + password (or email
  one-time passcode), attributes Given name, Surname, City, State/Province, Postal code, Country/Region. Add both
  `MyVedicStar-Web` and `MyVedicStar-Mobile` under the flow's **Applications**. Self-service password reset is
  enabled in the tenant (Authentication methods → Email OTP) and appears as "Forgot password?" on the sign-in page.
- Company branding (optional): logo, background and colors on the hosted pages.

## 2. Where each value comes from

| Config field (`auth.*`) | Entra admin center location                                                                               | Used by               | Required    | Secret | Example                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | --------------------- | ----------- | ------ | -------------------------------------------- |
| `mode`                  | —                                                                                                         | Web, Mobile           | Yes         | No     | `"entra-external-id"`                        |
| `authority`             | Overview → **Primary domain** `<sub>.onmicrosoft.com` → use `https://<sub>.ciamlogin.com/`                | Web, Mobile           | Yes         | No     | `https://myvedicstarexternal.ciamlogin.com/` |
| `tenantId`              | Overview → **Tenant ID**                                                                                  | Mobile (issuer), docs | Recommended | No     | `cbece845-…`                                 |
| `clientId`              | App registrations → _MyVedicStar-Web_ (web) / _MyVedicStar-Mobile_ (mobile) → **Application (client) ID** | Web / Mobile          | Yes         | No     | `146e4049-…`                                 |
| `apiClientId`           | App registrations → _MyVedicStar-API_ → **Application (client) ID**                                       | Web, Mobile           | Optional    | No     | `08f16180-…`                                 |
| `apiScopes`             | _MyVedicStar-API_ → **Expose an API** → scope                                                             | Web, Mobile           | Yes         | No     | `["api://08f16180-…/access_as_user"]`        |
| `redirectUri`           | _MyVedicStar-Web_ → Authentication → SPA redirect URI (must match exactly)                                | Web                   | Yes         | No     | `https://localhost:5173/auth/callback`       |
| `postLogoutRedirectUri` | _MyVedicStar-Web_ → Authentication → front-channel logout / redirect                                      | Web                   | Yes         | No     | `https://localhost:5173/`                    |
| `providers`             | —                                                                                                         | Web, Mobile           | No          | No     | `["email"]`                                  |

> **Common mistake:** `authority` is **not** `https://<sub>.onmicrosoft.com`. That is the tenant's domain name; the
> sign-in endpoint is `https://<sub>.ciamlogin.com/`. Startup validation rejects the `.onmicrosoft.com` form.

Never put in any client config: client secrets, certificates, APIM subscription keys, database or storage
credentials, Key Vault secrets, social-provider secrets. The web and mobile apps are public clients.

## 3. Environment matrix

| Setting          | DEV                                                                              | TEST         | UAT          | PROD                                        |
| ---------------- | -------------------------------------------------------------------------------- | ------------ | ------------ | ------------------------------------------- |
| Web URL          | `https://localhost:5173`                                                         | configurable | configurable | `https://www.myvedicstar.com`               |
| Callback         | `https://localhost:5173/auth/callback`                                           | configurable | configurable | `https://www.myvedicstar.com/auth/callback` |
| API URL          | `https://localhost:5173/api/v1` (proxied to shared host `http://localhost:5289`) | placeholder  | placeholder  | placeholder                                 |
| Authority        | configurable                                                                     | configurable | configurable | configurable                                |
| Web client ID    | configurable                                                                     | configurable | configurable | configurable                                |
| Mobile client ID | configurable                                                                     | configurable | configurable | configurable                                |
| API client ID    | configurable                                                                     | configurable | configurable | configurable                                |
| API scope        | configurable                                                                     | configurable | configurable | configurable                                |

`environment` values: `local`, `development`, `test`, `uat`, `staging`, `production`. In `uat`, `staging` and
`production` every URL must be HTTPS and mock sign-in is rejected at startup.

## 4. Web configuration (build once, deploy many)

```json
"auth": {
  "mode": "entra-external-id",
  "authority": "https://<ENTRA_EXTERNAL_ID_SUBDOMAIN>.ciamlogin.com/",
  "tenantId": "<ENTRA_EXTERNAL_TENANT_ID>",
  "clientId": "<MYVEDICSTAR_WEB_CLIENT_ID>",
  "apiClientId": "<MYVEDICSTAR_API_CLIENT_ID>",
  "apiScopes": ["api://<MYVEDICSTAR_API_CLIENT_ID>/access_as_user"],
  "redirectUri": "https://localhost:5173/auth/callback",
  "postLogoutRedirectUri": "https://localhost:5173/",
  "providers": ["email"]
}
```

Unfilled `<…>` placeholders are reported at startup (field names only, never values) and the app does not start.

### Local development (HTTPS)

All development settings, including the `auth` block, live in
**`infrastructure/web/config/config.development.json`**. `npm run web:dev` serves the app at
**`https://localhost:5173`** and serves that file as `/config.json`; edits apply on the next page load.

- **HTTPS with a trusted certificate (padlock, no warning):** one-time setup per machine with
  [mkcert](https://github.com/FiloSottile/mkcert), which creates a local certificate authority trusted only on your
  machine:

  ```powershell
  winget install --id FiloSottile.mkcert --exact   # then open a new terminal
  mkcert -install                                   # adds the local CA to your Windows trust store (confirm prompt)
  mkcert -cert-file apps/web/.certs/localhost.pem -key-file apps/web/.certs/localhost-key.pem localhost 127.0.0.1 ::1
  ```

  The dev server uses `apps/web/.certs/` automatically (gitignored — it contains a private key; never commit or share
  it). Without those files it falls back to a self-signed certificate (`@vitejs/plugin-basic-ssl`): still encrypted,
  but the browser shows "Not secure" and a one-time warning. Preview and E2E (`vite preview`, port 4173) stay on HTTP.
  `mkcert -install` may also report it could not update Java's keystore; that only matters for Java tools, not
  browsers.

- **Redirect URIs** in the Entra app registration (Single-page application platform) must be the HTTPS ones:
  `https://localhost:5173/auth/callback` and logout `https://localhost:5173/`.
- **API:** the dev server proxies `/api`, including `/api/v1/auth`, to the combined MyVedicStar host at
  `http://localhost:5289`, so `apiBaseUrl` is
  `https://localhost:5173/api/v1`. Calls stay same-origin: no CORS change in the backend and no mixed content.
  The VS Code **Web: debug in Chrome/Edge (starts API + dev server)** configurations start
  `../myvedicstar/src/MyVedicStar.API` with the `shared` profile. The legacy `../myvedicday` APIs have a different
  Entra audience and must not be substituted for that host. `MVS_DEV_API_ORIGIN` and
  `MVS_DEV_AUTH_API_ORIGIN` remain available for explicit custom targets.
  Debugger browser URLs use HTTPS to match the callback origin and its tab-scoped PKCE state.
- **CSP:** derived from the config (`connect-src` authority origin), plus `wss://localhost:5173` for hot reload.

### What the flow does (verified by `apps/web/e2e/entra-pkce.spec.ts` against a simulated tenant)

1. Login / Register / protected route → `GET <issuer>/.well-known/openid-configuration`, then a full-page redirect to
   `/oauth2/v2.0/authorize` with `response_type=code`, `code_challenge` (S256 of a random `code_verifier`), `state`,
   `redirect_uri`, `scope=openid profile offline_access <api scope>`, and `prompt=create` for Register.
2. Entra → `/auth/callback?code=…&state=…` → `state` checked, `POST /oauth2/v2.0/token` with
   `grant_type=authorization_code`, the `code` and the `code_verifier` (no client secret) → access, ID and refresh
   tokens held in memory → validated `returnTo` (default `/dashboard`).
3. API calls send `Authorization: Bearer <access token>`; an expired or expiring token is renewed with
   `grant_type=refresh_token`.
4. Logout → local session cleared → `GET /oauth2/v2.0/logout?id_token_hint=…&post_logout_redirect_uri=…` → home.
5. An Entra error response (`?error=access_denied&state=…`) is processed and shown as a friendly message
   (`?signin_error=cancelled`) with "Try again"; provider text is never displayed.

## 5. Mobile configuration

`EXPO_PUBLIC_AUTH` per EAS build profile, same schema, with the **mobile** client ID and custom-scheme redirect:

```json
{
  "mode": "entra-external-id",
  "authority": "https://<sub>.ciamlogin.com/",
  "tenantId": "<tenant-id>",
  "clientId": "<MYVEDICSTAR_MOBILE_CLIENT_ID>",
  "apiScopes": ["api://<api-client-id>/access_as_user"],
  "redirectUri": "myvedicstar://auth/callback",
  "postLogoutRedirectUri": "myvedicstar://",
  "providers": ["email"]
}
```

Android package / iOS bundle ID come from `apps/mobile/app.config.ts` (`com.myvedicstar.app[.<env>]`); the
`myvedicstar` URL scheme is registered by Expo for both platforms. No signing hash is needed for a custom-scheme
redirect with the system browser.
