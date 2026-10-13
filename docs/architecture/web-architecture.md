# Web architecture

React 19 + TypeScript + Vite 8 single-page application. Output is static files only — no Node.js at runtime.

## Startup

```text
index.html (no inline script)
  └─ /assets/index-[hash].js
       └─ bootstrap()
            1. GET /config.json (same origin, no-store) → validate with @myvedicstar/config
            2. createServices(config): api client, auth client, analytics/telemetry, QueryClient
            3. render <App>: ErrorBoundary → Services → QueryClient → I18n → Theme → Router
          on invalid config: friendly ConfigErrorScreen (no half-configured app)
```

## Layers

| Layer            | Folder                | Contains                                                                                                                                                                                                                           |
| ---------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition root | `src/app`             | bootstrap, `App`, route table, `SiteLayout`, 404 / route-error pages                                                                                                                                                               |
| Features         | `src/features/<name>` | pages, feature components, feature hooks; public API in `index.ts`                                                                                                                                                                 |
| Shared           | `src/shared`          | `components` (Button, Loading/Empty/Error/Offline states), `accessibility` (skip link, route announcer, route titles), `auth` (AuthClient interface + `useAuth`), `services`, `i18n`, `theme`, `hooks`, `routing/paths`, `storage` |

Data flow for backend data (from Phase 2 onward):

```text
Page → feature hook (useQuery with queryKeys.*) → services.api.<endpoint> → transport → backend
```

Components never call `fetch` (ESLint rule). The only direct `fetch` is loading `/config.json`.

## Routing

`src/app/router/router.tsx` — React Router 7 data router, every page lazily loaded. Route `handle` carries a title key
and screen name used for `document.title`, the screen-reader route announcement and screen analytics.

| Route                                                                                                                 | Access    | Status                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                                                                   | public    | ✅ Phase 2 — hero, live Panchang summary card, feature overview                                                                                                      |
| `/about`, `/help`                                                                                                     | public    | ✅ Phase 2                                                                                                                                                           |
| `/auth/callback`                                                                                                      | public    | ✅ completes the OIDC redirect; shows sign-in errors (`?error=`) with Try again                                                                                      |
| `/good-time`                                                                                                          | protected | ✅ Phase 4 — Find a Good Time: activity cards (radio group), date navigation, recommended times, not-recommended periods, "In brief", disclaimer; `?activity=&date=` |
| `/calendar`                                                                                                           | protected | ✅ Phase 4 (web) — month grid (Tithi at sunrise, rating, Ekadashi/Purnima/Amavasya), selected day’s Panchang and periods; `?month=YYYY-MM&day=YYYY-MM-DD`            |
| `/dashboard`                                                                                                          | protected | ✅ Phase 3 (web) — status, today’s Panchang, sunrise-to-sunrise timeline, quick links, auspicious times, times to avoid, why today is rated                          |
| `/today`, `/calendar/:date`, `/festivals`, `/festivals/:id`, `/panchang/:date`, `/locations`, `/settings`, `/profile` | protected | Phases 3–5 (paths reserved in `shared/routing/paths.ts`)                                                                                                             |
| `*`                                                                                                                   | public    | 404 page                                                                                                                                                             |

## Features (Phase 2)

| Feature           | Folder                              | Public API                                                                                              |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Location          | `features/location`                 | `LocationStateProvider`, `useLocationState`, `LocationSelector`, `LocationDialog`, `browserGeolocation` |
| Tradition         | `features/tradition`                | `TraditionStateProvider`, `useTradition`, `useTraditions`, `TraditionSelector`                          |
| Today (signed in) | `features/today`                    | `DaySummaryCard`, `usePanchangToday`, `useDaySummary`                                                   |
| Home, About, Help | `features/home`, `features/content` | pages                                                                                                   |
| Dashboard         | `features/dashboard`                | `DashboardPage`, `useDayDashboard` (view model `buildDayDashboard` in `@myvedicstar/domain-models`)     |
| Calendar          | `features/calendar`                 | `CalendarPage`, `useCalendarMonth` (view model `buildCalendarMonth` in `@myvedicstar/domain-models`)    |
| Auth              | `features/auth` + `shared/auth`     | `ProtectedRoute`, `AuthCallbackPage`; `AuthClient`, `useAuth`, `useStartSignIn`                         |

Signed-in location start-up: saved account default, otherwise saved location → otherwise, if permission is granted or not yet asked, one automatic request →
denial remembered, never re-prompted automatically → manual search, coordinates and recent locations always available.
The header shows brand · Home, Features, About, Help · location · tradition · Login, adapting from one row
(≥ 1200 px) to two rows with a menu (compact).

There are **no login or register pages**. Login (header, Get Started) and `ProtectedRoute` call
`useStartSignIn()`, which goes straight to the identity provider's hosted pages with a `returnTo` validated by
`sanitizeReturnPath` (same-origin relative paths only) — validated again after the provider redirects back. When sign-in
is not configured, Login are hidden and protected routes explain that sign-in is unavailable.

## Styling

- `@myvedicstar/design-tokens/tokens.css` (generated, drift-tested) defines CSS custom properties for both themes.
- CSS Modules per component; global CSS limited to reset, focus styles and a few utilities.
- Dark mode: `prefers-color-scheme` in CSS; an explicit choice sets `data-theme` on `<html>`. No inline script needed.
- Fluid layouts: `clamp()` typography, flex-wrap/grid, logical properties (RTL-ready), safe-area insets.

## Performance

| Measure                                        | Status                                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Route-level code splitting                     | ✅ every page is a lazy chunk                                                                                                                  |
| No inlined assets, hashed file names           | ✅ `assetsInlineLimit: 0`                                                                                                                      |
| Hidden source maps (not referenced by bundles) | ✅ excluded from upload by the deploy script                                                                                                   |
| Initial JS                                     | ~134 kB gzip (React DOM, React Router, Zod, TanStack Query). Budget target ≤ 120 kB — see Known issues: move schemas to `zod/mini` in Phase 6. |
| Core Web Vitals                                | No web fonts (system stack), no layout-shifting images; measure LCP/INP/CLS with RUM in Phase 6.                                               |
