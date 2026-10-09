# Mobile architecture

React Native 0.86 (New Architecture, Hermes) with **Expo SDK 57** and **Expo Router**.

## Why Expo (vs. React Native CLI)

| Need                                               | Expo                                              | RN CLI                                     |
| -------------------------------------------------- | ------------------------------------------------- | ------------------------------------------ |
| Android + iOS + tablets + foldables                | ✅ same                                           | ✅ same                                    |
| File-based routing with deep links                 | ✅ Expo Router                                    | manual (React Navigation + linking config) |
| Native builds without committing `android/` `ios/` | ✅ `expo prebuild` (Continuous Native Generation) | ❌ native projects in git                  |
| Cloud builds, signing, store submission            | ✅ EAS Build / Submit                             | manual Fastlane/Gradle/Xcode               |
| Custom native modules                              | ✅ config plugins / dev client                    | ✅                                         |
| Monorepo support                                   | ✅ automatic Metro config (SDK ≥ 52)              | manual Metro config                        |

Decision: Expo. Native directories are generated and git-ignored; native configuration lives in `app.config.ts`.

## Structure

```text
apps/mobile/
  app.config.ts          native config (bundle IDs per environment, permissions, orientation: default)
  app/_layout.tsx        root: config validation, providers, error boundary, status bar
  app/(tabs)/_layout.tsx primary navigation: Today · Calendar · Good Time · Festivals · More
  app/(tabs)/*.tsx       screens (Phase 1: labelled "coming soon" placeholders)
  app/+not-found.tsx     unknown deep links
  src/app/config.ts      EXPO_PUBLIC_* → validated AppConfig (@myvedicstar/config)
  src/shared/services.tsx api client, telemetry, QueryClient — same shared packages as web
  src/shared/theme.ts    tokens → RN values, light/dark from system, window size class
  src/shared/i18n.tsx    device locales → translator (@myvedicstar/localization)
  src/shared/components.tsx Screen (safe areas, readable width), AppText (font scaling), ComingSoon
```

## Adaptive layout (phones, tablets, foldables)

- `useWindowClass()` derives the class from `useWindowDimensions()`, which updates on rotation, foldable
  fold/unfold, split-screen and freeform resizing. No device-model checks.
- Tab bar: bottom on `compact`/`medium`; **side rail** (`tabBarPosition: 'left'`) on `expanded` and wider — e.g. an
  unfolded Galaxy Fold inner display in landscape or a tablet.
- Content is width-capped (`Screen` → max 720) so cards are not stretched on large displays. Two-pane layouts
  (Calendar | Day, Summary | Details) arrive with those features.
- Orientation `default` (portrait + landscape); iPad `requireFullScreen: false` (Split View); Android activities are
  resizable (never opted out).
- Hinge avoidance: safe-area insets are respected everywhere; when a feature needs precise fold geometry (two-pane
  split on the hinge), add Jetpack WindowManager via a config plugin (e.g. `react-native-foldable`-style module) and
  expose it through `useWindowClass` — tracked for Phase 6.

## Public experience (Phase 2)

| Piece                                                                                                                                                                     | Location                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Today tab for visitors: context bar (location, tradition), hero, Panchang summary card, feature overview, Login/Register; two panes (hero · card) on expanded windows     | `src/features/home/PublicTodayScreen.tsx`                |
| Summary card (same `buildDaySummary` view model as web; icon + text + color)                                                                                              | `src/features/today`                                     |
| Location: `expoGeolocation` (expo-location, foreground, balanced accuracy), provider with AsyncStorage persistence, location sheet (current, search, coordinates, recent) | `src/features/location`                                  |
| Tradition picker (sheet with radio options, persisted, independent of location)                                                                                           | `src/features/tradition`                                 |
| Login / Register (modal routes `/login`, `/register`; email hint + configured providers)                                                                                  | `src/features/auth`, `app/login.tsx`, `app/register.tsx` |
| Auth client (expo-auth-session + expo-secure-store; mock/disabled modes)                                                                                                  | `src/shared/auth`                                        |
| Providers used by the app and tests                                                                                                                                       | `src/app/AppProviders.tsx`                               |

Shared with web through packages: contracts, API client, validation, date/time formatting, day-summary and location
logic (`@myvedicstar/domain-models`), localization catalog and design tokens.

## Accessibility

`AppText` honours Dynamic Type / Android font scale (`maxFontSizeMultiplier` 2), headers use
`accessibilityRole="header"`, tabs have accessibility labels, touch targets use `touchTarget.minimum` (44).

## Configuration

`EXPO_PUBLIC_ENVIRONMENT`, `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_FEATURE_FLAGS` (JSON) are inlined at build time
per EAS profile (`eas.json`). Invalid configuration shows a startup error instead of a half-working app. Local
development defaults to `http://localhost:5275` (iOS simulator) or `http://10.0.2.2:5275` (Android emulator).

## Testing

Jest (`jest-expo` preset) + React Native Testing Library 14. `renderRouter` (expo-router/testing-library) tests
navigation and deep links. Mobile E2E: **Maestro** recommended (YAML flows, runs on Android emulators incl. foldable
AVDs and iOS simulators, simple CI) — see [../deployment/android.md](../deployment/android.md).
