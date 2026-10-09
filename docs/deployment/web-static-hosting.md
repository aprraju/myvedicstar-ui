# Web deployment — static hosting (Azure Storage static website)

> **Primary deployment target: Azure Static Web Apps** — see
> [infrastructure/web/static-web-apps/README.md](../../infrastructure/web/static-web-apps/README.md). This page
> documents the alternative Storage + Front Door hosting; the caching and build-once principles below apply to both.

The SPA is static files. No Node.js server runs in any environment.

## Build once, deploy many

```bash
npm ci
npm run web:build              # → apps/web/dist (BUILD_ID=<git sha> to stamp telemetry)
```

The same `dist/` is promoted through `development → test → staging → production`. Only `config.json` differs per
environment (written at deploy time; examples in `infrastructure/web/config/`). It is **public** — never put secrets
in it.

| Item               | Value                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Build command      | `npm run web:build`                                                                                |
| Output directory   | `apps/web/dist`                                                                                    |
| Index document     | `index.html`                                                                                       |
| 404 / SPA fallback | `index.html` (so deep links like `/calendar/2026-09-29` load the app; the app renders its own 404) |
| Runtime config     | `/config.json` (validated at startup)                                                              |
| Deploy script      | `infrastructure/web/deploy-azure-storage.sh <account> <config.json>`                               |

## Cache-control

| Path                          | Cache-Control                         | Why                                                               |
| ----------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| `/assets/*` (hashed)          | `public, max-age=31536000, immutable` | Content-addressed file names                                      |
| `/index.html`                 | `no-cache`                            | Always revalidate → new release visible immediately               |
| `/config.json`                | `no-cache`                            | Environment settings / feature flags can change without a rebuild |
| `/favicon.svg`, `/robots.txt` | `public, max-age=86400`               | Rarely change                                                     |
| `*.map`                       | not uploaded                          | Hidden source maps go to the error-monitoring provider only       |

Upload order: assets → root files → `config.json` → `index.html`, so a new `index.html` never references missing
chunks. Keep previous `assets/` for at least one release so open tabs can still lazy-load old chunks (the route error
page offers "Reload" if a chunk is gone).

**Never cache authenticated API responses at the CDN** — the API is a different origin and sets its own headers.

## HTTPS, custom domain, CDN and security headers

Azure Storage static websites serve HTTPS on the `*.web.core.windows.net` endpoint but **cannot set custom response
headers** (CSP, HSTS, etc.). Do not weaken security to compensate. Recommended:

```text
Browser ──HTTPS──► Azure Front Door (custom domain, managed TLS, WAF, rule set: security headers)
                         └──► Storage static website origin ($web)
```

1. Front Door Standard/Premium with the static website endpoint as origin; custom domain with managed certificate;
   HTTP → HTTPS redirect.
2. Rule set "security-headers": add every header printed by
   `npm run security:headers -w @myvedicstar/web -- <env config.json>`
   (Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, Permissions-Policy,
   Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy).
3. Caching: honour origin `Cache-Control`; purge `/index.html` and `/config.json` after deploy.
4. SPA deep links: the storage `404-document` fallback serves `index.html` **with HTTP status 404**. Browsers render the
   app correctly, but monitoring and crawlers see 404s. Add a Front Door rule "if the path has no file extension →
   URL rewrite to `/index.html`" so deep links return 200.
5. Optionally restrict the storage endpoint so traffic must go through Front Door.

Alternative: **Azure Static Web Apps** can set headers itself (`staticwebapp.config.json` → `globalHeaders`,
`navigationFallback: { rewrite: "/index.html", exclude: ["/assets/*"] }`).

## Backend CORS

Add each web origin (e.g. `https://www.myvedicstar.example`) to the API's `Cors:AllowedOrigins`.

## CI/CD

`.github/workflows/web.yml`: install → format check → lint → typecheck → unit/component tests → build → E2E (Playwright,
production CSP) → `npm audit` → upload `dist` artifact. Deployment jobs per environment use GitHub environments with
approvals and Azure OIDC federated credentials (no storage keys).
