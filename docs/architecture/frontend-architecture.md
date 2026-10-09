# Frontend architecture

My Vedic Star has two independently deployable frontends — a React web SPA and a React Native (Expo) app for Android and
iOS — built on framework-agnostic shared packages. The backend (`MyVedicDay` API, a separate repository) is the only
authority for Panchang values; the frontends display, format and explain what it returns.

```text
                         MyVedicDay API (separate repo, .NET)
                  /api/v1/panchang/* · /locations/resolve · /traditions
                                       │  HTTPS, JSON, Problem Details
                ┌──────────────────────┴───────────────────────┐
                │                                              │
        apps/web (React SPA)                         apps/mobile (Expo)
   static files → CDN / Azure Storage             Android / iOS binaries (EAS)
                │                                              │
                └────────────── packages/* (pure TypeScript) ──┘
      contracts · validation · api-client · date-time · design-tokens
          localization · analytics · config · testing (dev only)
```

## Principles

1. **Backend is authoritative.** No astronomy or Panchang calculation in the UI. The UI derives only presentation facts
   (e.g. "is now inside this window?", "does this period end tomorrow?") from backend instants.
2. **Hide complexity, not information.** Progressive disclosure: simple guidance first, full detail within one or two
   interactions.
3. **Layout follows the window, not the device.** Window size classes (`packages/design-tokens/src/window-class.ts`).
4. **Secure by default.** Strict CSP, no secrets in shipped code, tokens never persisted in browser storage or logged.
5. **Replaceable vendors.** Identity, analytics, maps and geocoding sit behind interfaces.

## Repository layout

```text
apps/
  web/                 React + Vite SPA (static output in dist/)
    src/app/           bootstrap, providers, router, layout — composes features
    src/features/      feature modules with a public index.ts (auth, home, dashboard, …)
    src/shared/        cross-feature UI: components, accessibility, i18n, theme, services, auth interface
    security/          CSP/security headers (single source of truth)
    e2e/               Playwright tests against the production build
  mobile/              Expo Router app
    app/               file-based routes (tabs: Today, Calendar, Good Time, Festivals, More)
    src/               config, services, theme, i18n, shared components, tests
packages/              framework-agnostic TypeScript, consumed as source (no build step)
docs/                  architecture, security, UX, deployment
infrastructure/web/    deploy script and example runtime configs
.github/workflows/     independent web and mobile pipelines
```

### Dependency rules (enforced by ESLint where possible)

| From → To                                                      | Allowed                          |
| -------------------------------------------------------------- | -------------------------------- |
| `packages/*` → React, React Native, Expo, `window`, `document` | ❌ (framework-agnostic)          |
| `apps/*` → `packages/*` internals (`@myvedicstar/x/src/…`)     | ❌ public entry only             |
| web `features/*` → another feature's internals                 | ❌ via its `index.ts` only       |
| web `features/*` → `shared/*`                                  | ✅                               |
| web `app/*` → `features/*`, `shared/*`                         | ✅ (composition root)            |
| web `shared/*` → `features/*`                                  | ❌                               |
| any UI code → `fetch()`                                        | ❌ use `@myvedicstar/api-client` |
| any UI code → `dangerouslySetInnerHTML`                        | ❌                               |

## Shared packages

| Package         | Responsibility                                                                                                                                                                                                                                                                                                                                                                 | Depends on                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `contracts`     | Zod schemas + types mirroring the backend DTOs; tolerant of new enum values and fields                                                                                                                                                                                                                                                                                         | zod                                   |
| `validation`    | User-input parsing/validation (city / ZIP / coordinates, dates, tradition, language); errors are localization keys                                                                                                                                                                                                                                                             | zod                                   |
| `api-client`    | HTTP transport (timeout, cancellation, correlation ID, auth header, error normalization, response validation), retry policy, typed endpoints, query keys                                                                                                                                                                                                                       | contracts                             |
| `date-time`     | Timezone-aware formatting in the _selected location's_ IANA zone; DST-safe local-day math                                                                                                                                                                                                                                                                                      | — (Intl)                              |
| `design-tokens` | Semantic tokens (color, spacing, type, radius, elevation, touch targets), generated CSS variables, window size classes                                                                                                                                                                                                                                                         | —                                     |
| `localization`  | Typed message catalogs, translator with fallback, interpolation and plurals, language negotiation                                                                                                                                                                                                                                                                              | — (Intl)                              |
| `analytics`     | Provider-independent analytics/telemetry interfaces, consent gating, redaction, coordinate coarsening                                                                                                                                                                                                                                                                          | —                                     |
| `config`        | Runtime configuration schema, feature flags, auth provider config, open-redirect-safe return paths                                                                                                                                                                                                                                                                             | zod                                   |
| `domain-models` | View models derived from backend data — day summary (tone from the backend's General status, paksha, current element, good time now/next from `/muhurta/good-times`, next caution), Find a Good Time view (`buildGoodTimeView`), selected/recent locations, location search, the `GeolocationProvider` interface and locate-then-resolve flow. Presentation only; no astronomy | contracts, date-time, validation, zod |
| `testing`       | Fixtures captured from the real API (all day ratings, Purnima, Amavasya, DST, errors), fixture builders (dev only)                                                                                                                                                                                                                                                             | contracts                             |

Packages export TypeScript source (`"exports": "./src/index.ts"`); Vite, Metro, Vitest and Jest compile them directly,
so there is no package build step and no version skew inside the monorepo.

## Key decisions

| #     | Decision                                             | Why                                                                                                                                                                                                |
| ----- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AD-1  | npm workspaces, no Turborepo/Nx                      | Two apps + small packages; npm 11 is already required. Add Turborepo later if CI time warrants caching.                                                                                            |
| AD-2  | Expo (managed, prebuild, EAS) for mobile             | Spec prefers Expo when evaluating; gives Expo Router deep links, EAS build profiles, OTA option, and first-class monorepo support. Native projects are generated (`expo prebuild`), not committed. |
| AD-3  | One React version (19.2.3) across the repo           | Pinned by Expo SDK 57; avoids duplicate React in the monorepo. React Router 7 (not 8) because 8 requires React ≥ 19.2.7.                                                                           |
| AD-4  | Runtime `config.json` for web                        | Build once, promote the same artifact through environments; config validated at startup.                                                                                                           |
| AD-5  | CSS Modules + CSS custom properties from tokens      | Zero runtime CSS-in-JS (CSP friendly), no utility-class build dependency, tokens shared conceptually with RN.                                                                                      |
| AD-6  | Zod in jitless mode                                  | Zod 4 otherwise probes `new Function`, which a strict CSP (no `unsafe-eval`) blocks.                                                                                                               |
| AD-7  | Fixtures captured from the real backend              | Contract tests prove the schemas match reality; MSW and Playwright serve the same fixtures.                                                                                                        |
| AD-8  | TypeScript 6.0                                       | Expo SDK 57 template version; typescript-eslint does not yet support TS 7.                                                                                                                         |
| AD-9  | `oidc-client-ts` (web), `expo-auth-session` (mobile) | Standards-based, provider-neutral OIDC + PKCE; web library lazily loaded. See [authentication](../security/authentication.md).                                                                     |
| AD-10 | Native `<dialog>` for web modals/bottom sheets       | Browser-provided modality, Esc and focus handling; no scroll-lock library injecting `<style>` tags (CSP).                                                                                          |
| AD-11 | Location and tradition as small app-state contexts   | Shared by unrelated routes; persisted as validated preferences; server data stays in TanStack Query.                                                                                               |

## Backend gaps (tracked for later phases)

The API now provides festivals/observances (`/festivals/upcoming`) and Good Time evaluation (`/muhurta/*`: activities,
good-times, explanation, day-summaries, good-times/best). Good Time logic stays on the backend: `domain-models/good-time.ts` and `good-time-month.ts` only
selects by the backend's `isGoodTime`/`status` and the clock, and Home/calendar use the General evaluation.
The current API does not yet provide: Masa (lunar month),
ZIP/postal-code search (the UI recognises ZIP codes and says so), place autocomplete (search resolves one best match),
or user profiles/saved locations. City-only search (`Austin`) **is** supported. The UI is built against typed
interfaces so these can be added without restructuring. This repository contains **no backend code**.
