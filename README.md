# My Vedic Star — UI

Web (React SPA) and mobile (React Native / Expo, Android + iOS) frontends for **My Vedic Star**, a Hindu Panchang
application. Panchang values are calculated by the separate **MyVedicDay API**; this repository contains UI code only.

> Status: **Phase 2 — Public experience** complete on web and mobile: public home with a live Panchang summary,
> location (current / search / coordinates / recent), tradition, Login/Register (OIDC + PKCE), responsive and
> foldable-aware layouts. **Find a Good Time** (Phase 4) is complete on web and mobile: activity cards, backend-ranked
> Good Times with "Why this time?", favorable periods not recommended because of a conflict, the AI "In brief"
> explanation (web) and the disclaimer, a Day / Month view (each day's status for the activity) and a "Next best
> times" tile (the backend's three best upcoming options). Home and the calendar show the backend's General status. See
> [Implementation phases](#implementation-phases).

## Architecture

```text
MyVedicDay API (separate repo)
        │ HTTPS · JSON · Problem Details
 ┌──────┴────────────────────────┐
 apps/web  (static SPA → CDN)    apps/mobile (Expo → Play Store / App Store)
 └──────────── packages/* (framework-agnostic TypeScript) ─┘
   contracts · validation · api-client · date-time · design-tokens · localization · analytics · config · testing
```

Web and mobile are **independently deployable** (separate pipelines, no shared runtime). Details:
[frontend architecture](docs/architecture/frontend-architecture.md) ·
[web](docs/architecture/web-architecture.md) · [mobile](docs/architecture/mobile-architecture.md) ·
[state](docs/architecture/state-management.md) · [API integration](docs/architecture/api-integration.md).

## Prerequisites

| Tool                      | Version                                                         |
| ------------------------- | --------------------------------------------------------------- |
| Node.js                   | 24 LTS (≥ 24.14; see `.nvmrc`)                                  |
| npm                       | 11                                                              |
| Web E2E                   | Playwright Chromium (`npm run e2e:install -w @myvedicstar/web`) |
| Android                   | Android Studio + SDK, JDK 17+                                   |
| iOS                       | macOS + Xcode (or EAS cloud builds)                             |
| Backend (optional, local) | MyVedicDay API at `http://localhost:5275`                       |

## Installation

```bash
npm ci
```

## Running web

```bash
npm run web:dev          # https://localhost:5173 (infrastructure/web/config/config.development.json; /api proxied to http://localhost:5275)
npm run web:build        # production build → apps/web/dist
npm run web:preview      # serve dist with production security headers at http://localhost:4173
```

## Running mobile

```bash
npm run mobile:start     # Expo dev server (press a / i)
npm run mobile:android   # Android emulator — API at http://10.0.2.2:5275
npm run mobile:ios       # iOS simulator (macOS) — API at http://localhost:5275
```

Android: [docs/deployment/android.md](docs/deployment/android.md) · iOS: [docs/deployment/ios.md](docs/deployment/ios.md)

## Testing

```bash
npm test                                  # all unit/component tests (packages: Vitest, web: Vitest + RTL + MSW, mobile: Jest + RNTL)
npm run test -w @myvedicstar/web          # web only
npm run test -w @myvedicstar/mobile       # mobile only
npm run web:e2e                           # Playwright against the production build and production CSP
```

Tests never call live APIs. Fixtures in `packages/testing/src/fixtures` are **captured from the real API**; to refresh
them after a backend contract change, run the API locally and re-fetch (e.g.
`curl "http://localhost:5275/api/v1/panchang/2026-09-29?place=Austin,%20Texas,%20USA&tradition=telugu"`), then run
`npm test` — contract tests validate every fixture.

## Linting and type checking

```bash
npm run lint             # ESLint (strict TypeScript, React hooks, jsx-a11y, import order, security rules)
npm run typecheck        # tsc --noEmit for every workspace (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)
npm run format:check     # Prettier
npm run check            # all of the above + tests
```

## Building

| Target                 | Command                                                | Output                   |
| ---------------------- | ------------------------------------------------------ | ------------------------ |
| Web                    | `npm run web:build`                                    | `apps/web/dist` (static) |
| Mobile JS bundles      | `npx expo export -p android -p ios` (in `apps/mobile`) | Hermes bytecode bundles  |
| Android / iOS binaries | `npx eas build --profile <preview\|production>`        | AAB / IPA via EAS        |

## Environment configuration

| Environments | `local`, `development`, `test`, `staging`, `production` |
| ------------ | ------------------------------------------------------- |

- **Web:** runtime `config.json` served next to `index.html`, rendered per environment at deploy time from `MVS_*`
  variables (build once, deploy many). Schema: `packages/config/src/app-config.ts`; the app reads it only through
  `useServices().config`. Local: `apps/web/public/config.json` (`dev:local`) and
  `infrastructure/web/config/config.development.json` (`web:dev`). Deployed environments:
  [infrastructure/web/static-web-apps/README.md](infrastructure/web/static-web-apps/README.md).
- Dev server proxy targets: `MVS_DEV_API_ORIGIN` (default `http://localhost:5275`), `MVS_DEV_AUTH_API_ORIGIN`
  (default `https://localhost:7055`).
- Telemetry: Azure Application Insights when `telemetry.enabled` and `telemetry.connectionString` are set (redacted,
  sampled, no vendor SDK).
- **Mobile:** `EXPO_PUBLIC_ENVIRONMENT`, `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_FEATURE_FLAGS` per EAS profile
  (`apps/mobile/eas.json`).
- Feature flags: `goodTime`, `notifications`, `aiExplanation`, `kundali`, `horoscope`, `compatibility`, `premium`
  (default off). Read via `isFeatureEnabled(config, flag)` — never via scattered environment checks.
- **Everything in this configuration is public.** No secrets, client secrets, tokens or keys — ever.

## Deployment

- Web → **Azure Static Web Apps** (production; deployed by GitHub Actions on every push to `main`, one artifact):
  [infrastructure/web/static-web-apps/README.md](infrastructure/web/static-web-apps/README.md).
  `npm run web:deploy -- --environment production --env-file infrastructure/web/static-web-apps/environments/production.env`, `npm run web:validate-build`.
- Android / iOS → EAS Build and Submit: [android](docs/deployment/android.md), [iOS](docs/deployment/ios.md).
- CI: `.github/workflows/web.yml` and `.github/workflows/mobile.yml` (path-filtered, independent).

## Security

Strict CSP (no `unsafe-inline`/`unsafe-eval`), no secrets in shipped code, tokens never persisted in browser storage or
logged, open-redirect protection, redacting telemetry, validated inputs and responses.
[Frontend security](docs/security/frontend-security.md) · [CSP](docs/security/content-security-policy.md) ·
[Authentication](docs/security/authentication.md).

UX: [design system](docs/ux/design-system.md) · [responsive & foldables](docs/ux/responsive-design.md) ·
[accessibility](docs/ux/accessibility.md).

## Repository structure

```text
apps/
  web/            React + Vite SPA (src/app, src/features, src/shared, security/, e2e/)
  mobile/         Expo Router app (app/ routes, src/)
packages/
  analytics/      provider-independent analytics & telemetry, redaction
  api-client/     typed HTTP client, errors, retry policy, query keys
  query-cache/    shared React query hooks, policies, account isolation and optional persistence
  config/         runtime config schema, feature flags, safe return paths
  contracts/      Zod schemas of the backend API
  domain-models/  day summary, location and geolocation logic shared by web and mobile
  date-time/      timezone-aware presentation utilities
  design-tokens/  semantic tokens, generated CSS variables, window size classes
  localization/   message catalogs and translator
  testing/        API fixtures (dev only)
  validation/     user-input validation
docs/             architecture · security · ux · deployment · design (reference theme kit, not shipped)
infrastructure/   web deployment: static-web-apps/ (Bicep, deploy scripts, environment templates), dev configs
.github/workflows web and mobile pipelines
```

## Dependency governance

Before adding a package: check whether the repo already covers it, prefer maintained libraries, avoid overlap, check
bundle size, CSP compatibility (no `eval`/`new Function`/inline styles or scripts, no remote code) and web/mobile
compatibility, and record why in the pull request. Versions are exact (`.npmrc save-exact`).

## Implementation phases

1. **Foundation** ✅
2. **Public experience** ✅ — Home, location, tradition, day summary, Login/Register (OIDC), responsive layouts
3. Authenticated Today — Dashboard, Panchang summary, auspicious times, times to consider, timeline
4. Planning — Calendar, Full Panchang, **Find a Good Time ✅** (web and mobile; the backend rules engine decides every
   status and Good Time — the UI never promotes a period itself)
5. Personalization — saved locations, tradition, profile, settings, notifications
6. Hardening — accessibility/security/CSP audits, performance, cross-browser, device and foldable tests, visual regression
