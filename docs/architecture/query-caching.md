# Query caching across web and mobile

`@myvedicstar/query-cache` supplies the platform-neutral React hooks, policies, query client, account isolation,
invalidation and persistence allowlist. Both applications create one client in their existing services factory.
The existing API client still owns URLs, authentication, response validation, timeout handling and cancellation.
UI selections remain in router parameters or component/context state.

## Configuration

Web `config.json` accepts this optional section. The deployment renderer and GitHub workflow accept the same JSON
through `MVS_CACHE`. Mobile uses `EXPO_PUBLIC_CACHE` JSON. Defaults shown below are applied to omitted properties.

```json
{
  "cache": {
    "enabled": true,
    "persist": false,
    "prefetchTomorrow": false,
    "schemaVersion": "1",
    "rulesVersion": "1",
    "calculationVersion": "1"
  }
}
```

Bump `rulesVersion` with calculation-rule deployments and `calculationVersion` with engine changes. Bump
`schemaVersion` when persisted schemas or key meanings change. These deployment-controlled values isolate keys and
form the persistence buster; the server's own version fields remain unchanged in responses. The frontend cannot
discover a server deployment without a request, so synchronize these settings with backend releases.

`enabled: false` disables fresh calculation-cache reuse, uses zero unused-cache retention and skips persistence and
prefetching. Concurrent identical requests still deduplicate. The existing session-scoped login/profile POST keeps
its once-per-session behavior because repeating it would repeat login audit writes.

## Cache identity includes all response inputs

Endpoint factories remain in `@myvedicstar/api-client`. `scopedKey` adds account identity and schema/rules/engine
versions. Keys never contain access tokens. Calculation keys use the resolved coordinates and IANA timezone, rather
than a city label. Independent contexts switch keys and retain useful earlier results instead of clearing the cache.

| Query | Inputs included |
| --- | --- |
| Today | Resolved local date, latitude, longitude, timezone, tradition, language, account and versions |
| Panchang date / Tomorrow | Explicit date plus the same calculation context |
| Panchang range / next ten days | Start date, number of days plus calculation context |
| Panchang month | Year, month plus calculation context |
| Good Time / explanation | Resolved or explicit date, activity, optional Nakshatra, Other activity text plus calculation context |
| Good Time month / selected-date best windows | Start date, range length, activity, Nakshatra, Other text plus calculation context |
| Next best times | Location's current date, activity, Nakshatra, Other text, result count, search length plus calculation context |
| Festivals | Location's current date, range length plus calculation context |
| Catalogs | Language, tradition when accepted by the endpoint, account and versions |
| Profile | Signed-in user ID; memory only |
| Autocomplete | Normalized Unicode search text, country, language and result limit |
| Reverse / timezone | Exact coordinates; reverse language when used |

The current calculation API has no selected clock-time, calendar-settings or calculation-mode input. No fictional
request parameters are introduced. Time-dependent Today/relative searches are anchored to the selected location's
local date. Daily interval presentation recomputes Now/Next from the clock every minute and on resume; it ignores
cached `nowSegmentId`/`nextGoodTimeId` values. Next-best options that ended are hidden locally, and their query refreshes
at a returned window's end. If the API adds a time or calculation-setting input, add it to the typed parameters,
key factory and key-isolation tests together. Compile-time exhaustive key checks cover the existing Panchang and
Good Time parameter interfaces.

Existing normalization is retained: place names and relevant Other text are trimmed and case-insensitive; birth-star
names are trimmed and case-insensitive, and empty/missing birth stars are equivalent because both are omitted from
the API request. Other text is ignored for other activities, matching the transport. Other optional values remain
distinct where request behavior differs.

## Policies and lifecycle

Policies are centralized in `packages/query-cache/src/policies.ts` and individual queries override defaults.

| Data | Freshness | Unused retention |
| --- | --- | --- |
| Default reads | 5 minutes | 6 hours |
| Today | Until the next local midnight | 24 hours |
| Panchang dates / ranges / month | 12 hours | 24 hours |
| Good Time, explanation, month summaries | 1 hour | 6 hours |
| Live next-best search | 5 minutes; refresh at a window end | 6 hours |
| Catalogs | 24 hours | 24 hours |
| Location autocomplete | Configurable; default 24 hours | At most 1 hour |
| Reverse / timezone | Configurable; default 7 days | At most 24 hours |

`staleTime` controls eligibility for refresh; `gcTime` controls unused memory retention. Neither replaces the
24-hour persistence restoration maximum age. Browser focus and reconnect refetch stale reads, not fresh reads.
Autocomplete avoids automatic focus/reconnect refetching. Mobile bridges AppState and NetInfo to TanStack's managers.
No calculation polling was added. [TanStack's native integration guidance](https://tanstack.com/query/latest/docs/framework/react/react-native)
describes these manager bridges.

`useLocalDate` uses timezone-aware next-midnight calculation, a timer and resume/reconnect notifications. DST days
can have 23 or 25 hours. Today switches to a new key at midnight and accepts only a response for that date and zone;
yesterday is never a placeholder for Today. Invalid/incomplete calculation inputs do not start requests. Date,
location or activity changes switch keys immediately, while a short debounce delays new requests. Previous-selection
placeholders were removed; obsolete API requests receive an AbortSignal.

`useToday`, `useGoodTime`, `useTomorrow`, `useNextTenDays`, `usePanchangDate` and `usePanchangRange` are reusable shared
hooks. Month/range/Today responses seed their authoritative daily responses into the same per-date cache with original
fetch timestamps. Complete overlapping ranges can reuse those entries. No missing days are fabricated. The mobile
Calendar route is still its existing Coming Soon screen; shared date/month hooks are ready for its eventual UI.

Tomorrow prefetch is opt-in, occurs only after Today succeeds for an authenticated user, and prefetches one date.
It does not issue protected Tomorrow requests for visitors. Adjacent months and every activity are not prefetched.

## Persistence and offline access

Web uses an IndexedDB async storage adapter; native uses existing AsyncStorage. Both use the official TanStack async
storage persister and `PersistQueryClientProvider`, which waits for restore before fetching. Restoration checks the
buster, total age, individual fetch age, Zod schema, account scope and current local date; hashes are recomputed from
validated keys. Failed storage falls back to normal requests. See [TanStack's persistence lifecycle](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient).

Only anonymous Today responses are approved for persistence. Authenticated calendar, Good Time, birth-star inputs,
Other text, profiles and mutations are excluded. Protected data can be reused in memory only by the same active
identity. Logout/account switches cancel and remove the previous account's queries without deleting public caches.
This deliberately avoids restoring data that would bypass a fresh authorization check after app termination.

Persistence is bounded to 512 KiB per response and 2 MiB total, with a 24-hour max age. Oversized entries are not
persisted; oversized total storage is removed. Browser preferences and recent locations keep their existing small
preference storage. Query datasets never use localStorage. Tokens remain in their existing auth storage.

Today cards show an offline saved-data notice with the last fetch time. An uncached current date/location shows
an unavailable message. Cached data remains visible during background refresh failures, with the existing retry/error
UI. An offline date rollover does not relabel yesterday as Today.

## Invalidation, retries and diagnostics

`invalidateCalculations(client, family?)` invalidates calculation families; use the narrowest family or an exact scoped
key for a settings mutation. `removeUserCache` removes only one account. A change in independent date/location/activity
inputs normally requires a new key instead of invalidation.

Transient network/timeouts and 502/503/504 retry at most twice. 400/401/403/404 and deterministic errors do not retry.
429 retries only when a positive Retry-After is supplied; the full delay is respected, without the old 30-second cap.
Mutations do not retry automatically.

Development/test cache diagnostics use the existing telemetry sink: observer hits/misses, fetch duration, errors,
retries, invalidations, query count and storage failures. They contain family names/counts/durations only, never keys,
coordinates, user IDs, response bodies or tokens. Observer hits are reuse indicators, not a universal exact count of
avoided transport calls. Production diagnostic emission is disabled.

## Verification and performance

Run `npm run test -w @myvedicstar/query-cache`, the existing screen tests, type checks, and `npm run cache:benchmark`.
The benchmark report is in `docs/performance/query-cache-benchmark.json`.

The mocked benchmark compares the previous 5-minute policy with the shared 1-hour Good Time policy. Ten immediate
visits make one request under both policies; ten visits spaced six minutes apart make ten requests before and one
after. The reported query-resolution durations use 20 ms simulated transport latency and are not browser paint,
physical-device measurements, production Azure measurements or promised latency improvements. Live production
request counts and render measurements remain a deployment follow-up.
