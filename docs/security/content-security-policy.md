# Content Security Policy

The web SPA is built to run under a strict CSP with **no `unsafe-inline` and no `unsafe-eval`**.
Source of truth: [`apps/web/security/headers.ts`](../../apps/web/security/headers.ts).

## Production policy

```text
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
font-src 'self';
connect-src 'self' <API origin> [<identity authority origin>] [<telemetry origin>];
manifest-src 'self';
worker-src 'self';
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

Each deployment generates the exact headers for its environment (`connect-src` from that environment's runtime
config) into `staticwebapp.config.json`; preview them without deploying:

```bash
npm run web:deploy -- --environment production --env-file infrastructure/web/static-web-apps/environments/production.env --dry-run
```

## Required external origins

| Directive     | Origin                                                  | Why                                                                                                                                                                                                                     | When                                              |
| ------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `connect-src` | MyVedicDay API origin (`apiBaseUrl`)                    | All backend calls                                                                                                                                                                                                       | Always                                            |
| `connect-src` | Identity authority (e.g. `https://<sub>.ciamlogin.com`) | OIDC discovery, token redemption and refresh-token renewal (oidc-client-ts). Sign-in and logout are top-level redirects, so no `frame-src`/`form-action` exception is needed; refresh tokens avoid silent-renew iframes | When `auth.mode` is `entra-external-id` or `oidc` |
| `connect-src` | Telemetry ingestion endpoint                            | Operational telemetry                                                                                                                                                                                                   | When `telemetry.endpoint` is set                  |
| `connect-src` | Application Insights ingestion (`IngestionEndpoint`)    | Operational telemetry (`POST /v2/track`, no SDK script)                                                                                                                                                                 | When telemetry is enabled with `connectionString` |
| `img-src`     | Map tile origin                                         | Optional location map                                                                                                                                                                                                   | Only if a map is added; document here             |

No third-party scripts, fonts or stylesheets are loaded. `data:` in `img-src` covers small SVG data URIs from
libraries; it can be removed if unused after Phase 6 review.

## How the codebase stays compatible

| Risk                          | Mitigation                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Inline bootstrap scripts      | `index.html` contains only `<script type="module" src>`; Vite module-preload polyfill disabled; E2E asserts no CSP violations |
| Theme "flash" scripts         | Theme uses CSS `prefers-color-scheme`; explicit choice set via `data-theme` from the app bundle                               |
| CSS-in-JS injecting `<style>` | Not used: CSS Modules are extracted to `.css` files                                                                           |
| `style` attributes            | React sets `style` via the CSSOM at runtime, which CSP does not block (only markup attributes/`<style>` are)                  |
| `eval` / `new Function`       | ESLint `no-eval`, `no-implied-eval`, `no-new-func`; Zod configured `jitless`; build output grep in CI                         |
| Inlined assets                | `assetsInlineLimit: 0`                                                                                                        |
| HTML injection                | `dangerouslySetInnerHTML` banned by ESLint                                                                                    |

**Verification:** Playwright E2E runs against `vite preview`, which sends this policy; any
`securitypolicyviolation`/"Refused to …" console error fails the test.

## Development server

`npm run web:dev` sends the same policy, built per request from the environment's config (API and identity authority
origins in `connect-src`). Two development-only additions: `ws://localhost:<port>` for hot reload, and a random
nonce per server start on `script-src`/`style-src`, because Vite injects the React Fast Refresh preamble and CSS as
inline elements in development (`html.cspNonce` stamps them). Production builds contain no inline code and get no
nonce. Neither adds `'unsafe-inline'` or `'unsafe-eval'`.

## Where to apply the headers

Headers must come from the host, never from a `<meta>` CSP: `frame-ancestors`, `report-to` and `sandbox` are ignored
in meta tags.

| Hosting                            | Where                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Azure Static Web Apps (production) | `staticwebapp.config.json` → `globalHeaders`, generated per environment by `infrastructure/web/static-web-apps/scripts/static-web-app-config.ts` |
| Other CDN / reverse proxy          | Edge response-header rules                                                                                                                       |
| Local preview / E2E                | `vite preview` (`preview.headers` in `vite.config.ts`)                                                                                           |

## Reporting (recommended)

Deploy first with `Content-Security-Policy-Report-Only` alongside the enforced policy when adding a new origin, with a
`Reporting-Endpoints` header and `report-to` directive (`buildContentSecurityPolicy({ reportTo })`).

## Changing the policy

1. Update `security/headers.ts` (and this document's origin table) in the same pull request as the feature needing it.
2. Justify each new origin; never add `unsafe-inline`, `unsafe-eval` or wildcards.
3. Update the CDN rule set as part of deployment.
