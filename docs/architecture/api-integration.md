# API integration

```text
UI component → feature hook (useQuery) → ApiClient endpoint → HttpTransport → MyVedicDay API
                                            ▲ Zod contract validation ▲ error normalization
```

## Base URL and endpoint configuration

- `apiBaseUrl` **includes the API version**, e.g. `http://localhost:5275/api/v1` (development) or
  `https://api.myvedicstar.example/api/v1`. Moving to a new API version is a configuration change.
- Endpoint paths are **configuration, not code**: `endpoints` in `config.json` (web) or `EXPO_PUBLIC_API_ENDPOINTS`
  (mobile, JSON). Any subset may be given; missing ones use the defaults in
  `packages/api-client/src/endpoints.ts`, which mirror the backend OpenAPI document (`/openapi/v1.json`).
- Paths are validated at startup: relative to `apiBaseUrl` only (no scheme, no `//`, no `.`/`..` segments — configuration
  can never send requests to another host), exactly the required `{placeholders}`, and unknown names are rejected.

| Config name          | Default path                     | OpenAPI operation                     |
| -------------------- | -------------------------------- | ------------------------------------- |
| `traditions`         | `/traditions`                    | GetTraditions                         |
| `glossary`           | `/panchang/glossary`             | GetGlossary (`tradition`, `language`) |
| `panchangTraditions` | `/panchang/traditions`           | GetPanchangTraditions                 |
| `panchangToday`      | `/panchang/today`                | GetPanchangToday                      |
| `panchangTomorrow`   | `/panchang/tomorrow`             | GetPanchangTomorrow                   |
| `panchangTenDays`    | `/panchang/ten-days`             | GetPanchangTenDays                    |
| `panchangRange`      | `/panchang/range`                | GetPanchangRange (`start`, `days`)    |
| `panchangMonth`      | `/panchang/month/{year}/{month}` | GetPanchangMonth                      |
| `panchangYear`       | `/panchang/year/{year}`          | GetPanchangYear                       |
| `panchangDate`       | `/panchang/{date}`               | GetPanchangForDate                    |
| `locationsResolve`   | `/locations/resolve`             | ResolveLocation                       |

Location query parameters follow the OpenAPI names: `place`, `latitude`, `longitude`, `timeZone`.

Environment configs: `apps/web/public/config.json` (local), `infrastructure/web/config/config.development.json`
(served by `npm run web:dev`), `infrastructure/web/config/config.production.example.json`.

## Endpoints (`@myvedicstar/api-client` → backend `api/v1`)

| Client method                                                         | Backend                                           |
| --------------------------------------------------------------------- | ------------------------------------------------- |
| `panchang.today / tomorrow / tenDays(params)`                         | `GET /panchang/today · /tomorrow · /ten-days`     |
| `panchang.date(date, params)`                                         | `GET /panchang/{yyyy-MM-dd}`                      |
| `panchang.range(start, days, params)`                                 | `GET /panchang/range?start=&days=`                |
| `panchang.month(year, month, params)` · `panchang.year(year, params)` | `GET /panchang/month/{y}/{m}` · `/year/{y}`       |
| `panchang.traditions(language)` · `panchang.glossary(language)`       | `GET /panchang/traditions` · `/panchang/glossary` |
| `locations.resolve(location)`                                         | `GET /locations/resolve`                          |
| `traditions.list(language)`                                           | `GET /traditions`                                 |

`params = { location: { place? | latitude+longitude, timeZone? }, tradition?, language? }`.
Coordinates are rounded to 2 decimals (the backend's `Location:CoordinateDecimalPlaces`) before sending — no more
precision than the calculation uses.

## Transport responsibilities (centralized)

| Concern          | Behaviour                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL         | From runtime config; trailing slashes normalized                                                                                                                                  |
| Headers          | `Accept: application/json`, `X-Correlation-ID` (backend echoes/uses it), `Authorization: Bearer` only for `auth: 'optional' / 'required'` requests                                |
| Credentials      | `credentials: 'omit'` (bearer tokens, no cookies); `redirect: 'error'`                                                                                                            |
| Timeout          | Default 15 s (configurable); timeout vs. caller cancellation distinguished                                                                                                        |
| Cancellation     | Caller `AbortSignal` (TanStack Query passes one) linked without `AbortSignal.any` (not on every runtime)                                                                          |
| Response parsing | JSON → Zod schema; contract mismatch → `ApiError(kind: 'unknown')`, never rendered                                                                                                |
| Errors           | RFC 7807 Problem Details → `ApiError` with `kind`, `status`, `correlationId`, `fieldErrors`; 422 `detail` kept (consumer-facing by backend design); all other server text dropped |
| 401              | `onUnauthorized` hook (auth client refresh/sign-in, Phase 2)                                                                                                                      |
| Retry            | Not in the transport. `shouldRetryQuery`/`retryDelayMs` used by TanStack Query for reads only                                                                                     |
| Telemetry        | `onRequestComplete` → operation name, status, duration, outcome, correlation ID. No URL, query string, headers or body                                                            |

## Error kinds → UI

| `kind`           | From                            | Message key                             | Retry offered |
| ---------------- | ------------------------------- | --------------------------------------- | ------------- |
| `validation`     | 400, 422                        | `errors.validation` (or field messages) | no            |
| `authentication` | 401 / missing token             | `errors.authentication`                 | no (sign in)  |
| `authorization`  | 403                             | `errors.authorization`                  | no            |
| `notFound`       | 404                             | `errors.notFound`                       | no            |
| `rateLimit`      | 429                             | `errors.rateLimit`                      | yes           |
| `network`        | fetch failure / offline         | `errors.network`                        | yes           |
| `timeout`        | client timeout, 408             | `errors.timeout`                        | yes           |
| `server`         | 5xx                             | `errors.server`                         | yes           |
| `cancelled`      | caller aborted                  | — (not shown)                           | —             |
| `unknown`        | contract mismatch, invalid JSON | `errors.unknown`                        | yes           |

## Contracts

`@myvedicstar/contracts` mirrors `MyVedicDay.Api/Contracts/**`. Enumerations the backend may extend
(`classification`, `rating`, `kind`) are strings with documented `Known*` unions; unknown fields are stripped. Fixtures
in `@myvedicstar/testing` are **captured from the running API** and validated by contract tests — refresh them when
the backend contract changes (see README).

## CORS

The backend allows `GET` from configured origins (`Cors:AllowedOrigins`) with any header and exposes
`X-Correlation-ID`. Each web environment's origin must be added there. Non-GET endpoints (profiles, saved locations)
will need the backend CORS policy extended.
