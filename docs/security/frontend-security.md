# Frontend security

Everything shipped to a browser or app binary is public. Frontend validation improves UX; the backend is the security
boundary.

## Controls

| Threat                     | Control                                                                                                                                                                     | Where                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| XSS                        | React escaping; `dangerouslySetInnerHTML` banned (ESLint); strict CSP; backend text rendered as text only                                                                   | `eslint.config.js`, CSP                        |
| Script injection / eval    | No `eval`/`new Function` (ESLint); Zod jitless                                                                                                                              | `packages/contracts/src/primitives.ts`         |
| Open redirect              | `sanitizeReturnPath` accepts same-origin relative paths only (rejects `//`, `\`, schemes, control chars)                                                                    | `packages/config/src/return-path.ts` (+ tests) |
| Token theft                | Tokens in tab-scoped sessionStorage (web); secure storage (mobile); never in `localStorage`, URLs or logs; `credentials: 'omit'`                                            | [authentication.md](authentication.md)         |
| Sensitive logging          | Telemetry redacts auth/token/password/cookie/email/phone/birth/coordinate keys; scrubs bearer tokens, JWTs, emails from strings; API metrics exclude URLs and query strings | `packages/analytics/src/privacy.ts`            |
| Server detail leakage      | `ApiError.message` generic; UI maps `kind` → friendly text; only 422 business-rule detail is shown                                                                          | `packages/api-client/src/errors.ts`            |
| Contract tampering / drift | Every response validated with Zod before rendering                                                                                                                          | `packages/contracts`                           |
| Clickjacking               | `frame-ancestors 'none'`                                                                                                                                                    | CSP                                            |
| MIME sniffing              | `X-Content-Type-Options: nosniff`                                                                                                                                           | headers                                        |
| Referrer leakage           | `Referrer-Policy: strict-origin-when-cross-origin`                                                                                                                          | headers                                        |
| Powerful features          | `Permissions-Policy`: geolocation self only; camera, mic, payment, USB, sensors off                                                                                         | headers                                        |
| Downgrade                  | HSTS (2 years, preload) at the edge; `upgrade-insecure-requests`; HTTPS-only API URLs outside local                                                                         | headers, `@myvedicstar/config`                 |
| Secrets in config          | Config schema is `strict` (unknown keys rejected, values never echoed in errors); no client secrets (public OIDC client)                                                    | `packages/config/src/app-config.ts`            |
| Input abuse                | Length limits and patterns mirroring the backend (place ≤ 120 chars, lat −90…90, lon −180…180, tradition/language patterns); validated again by the backend                 | `packages/validation`                          |
| Tampered local storage     | Preferences validated with Zod on read; invalid values ignored                                                                                                              | `apps/web/src/shared/storage`                  |
| Dependency vulnerabilities | Exact versions (`save-exact`), lockfile, `npm audit --omit=dev --audit-level=high` in CI, Dependabot (recommended)                                                          | `.github/workflows`                            |
| Third-party script risk    | No third-party scripts; analytics behind `AnalyticsClient` interface and consent                                                                                            | `packages/analytics`                           |

## Privacy

- Precise location is privacy-sensitive: coordinates are rounded to 2 decimals (~1 km) before being sent to the API and
  never sent to analytics (`coarsenCoordinate` to 1 decimal if coarse region context is ever needed).
- Analytics events are sent only with consent (`hasAnalyticsConsent`, consent UI in Phase 5). Operational telemetry
  contains no personal data.
- The UI will always state when current location is in use and allow removing saved locations (Phase 2/5).

## Secure development checklist (per pull request)

- [ ] No new origins without updating `security/headers.ts` and the CSP document
- [ ] No `fetch` outside `api-client`, no HTML injection, no `eval`
- [ ] New user input validated in `@myvedicstar/validation` with length limits
- [ ] No tokens, emails, coordinates or free text in telemetry properties
- [ ] New dependencies justified (see README "Dependency governance")
