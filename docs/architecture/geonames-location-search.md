# GeoNames location search

The enhancement uses the existing location modal/sheet, geolocation providers, preference storage, API transport,
APIM origin and shared TanStack client. It adds worldwide suggestions and international postal lookup, country
filtering, timezone resolution after selection, and exact-coordinate preservation. Existing routes and calculation
contracts remain intact. GeoNames is accessed through API proxy routes, never directly from browser/native UI code.

## Current integration status

The frontend and a tested .NET integration library are in this repository. The library is staged under
`infrastructure/location-search-proxy`; it is not installed into either neighboring backend checkout. The active
backend checkout and a dedicated GeoNames account still need to be identified. `locationSearch.enabled` defaults to
false until those endpoints are available. No new Azure service, backend deployment or GeoNames account was created.

## Frontend configuration

Web `config.json` supports the following section. Deployment/GitHub variables use `MVS_LOCATION_SEARCH` JSON; native
uses `EXPO_PUBLIC_LOCATION_SEARCH` JSON. Do not include a GeoNames username in frontend configuration.

```json
{
  "locationSearch": {
    "enabled": true,
    "debounceMs": 350,
    "maxResults": 8,
    "recentLimit": 5,
    "searchStaleTimeMs": 86400000,
    "resolveStaleTimeMs": 604800000
  }
}
```

Optional endpoint overrides use the existing `endpoints` configuration keys: `locationsSearch`, `locationsPostal`,
`locationsReverse`, `locationsTimezone`. All are relative to the existing `apiBaseUrl` and inherit gateway prefixes.
The existing `locationsResolve` endpoint is unchanged and remains the fallback workflow when the feature is off.

Search begins after two characters and a configurable debounce. Text is Unicode-normalized, then classified by the
existing shared parser. Postal queries never assume the US; country is optional. Coordinates are validated and retain
their original latitude/longitude ordering. Suggestions show city, region, country and optional postal code, with stable
provider IDs and duplicate removal. Timezone is fetched only after a suggestion is selected. A reverse-label failure
still permits exact coordinates when a valid IANA timezone was returned; a missing timezone blocks selection.

Web implements combobox/listbox interaction, ArrowUp/ArrowDown, Enter, Escape, clear, loading, empty states and retry.
Native supports tap selection and country names or ISO codes with country suggestions. The existing sheet scrolls with
keyboard insets and retains handled touch events. Exact locations remain in local recent/preference storage; recent
list length is configurable, duplicate IDs are removed, and individual deletion remains available. Recent locations
are shown when search text is empty. The feature never requests GPS permission at startup; users select the current
location button. An intervening manual choice prevents late GPS results from overwriting it.

The existing `source` names are retained (`current`, `search`, `coordinates`), alongside optional GeoNames ID, city,
region, country and postal code. Precise coordinates are retained separately from any nearest-city label. When the
enhancement is enabled, the client transmits the original coordinates to calculation endpoints. The existing backend
calculation/coordinate-normalization policy remains authoritative and has not been rewritten by this frontend work.

## Install the proxy in the existing .NET API

Reference the library project from the active `MyVedicDay.Api` project, or move its source into the existing backend
location integration/API layers. It targets .NET 10 and uses only the existing ASP.NET framework; no NuGet provider SDK
or additional Azure resource is required.

After the host registers its existing `public-read` rate-limit policy, register:

```csharp
using MyVedicStar.LocationSearch;

builder.Services.AddGeoNamesLocationSearch(builder.Configuration);
```

The existing `app.MapControllers()` discovers the added controller through `AddApplicationPart`. The four additive
anonymous routes use the same `public-read` policy as the existing anonymous location resolver:

| Route under `/api/v1` | Query inputs | Response |
| --- | --- | --- |
| `/locations/search` | `text`, optional `country`, `language`, `maxRows` (1–8) | `{ "results": [...] }` |
| `/locations/postal` | `text`, optional `country`, `maxRows` | `{ "results": [...] }` |
| `/locations/reverse` | Required `latitude`, `longitude`, optional `language` | `{ "place": suggestionOrNull }` |
| `/locations/timezone` | Required `latitude`, `longitude` | `{ "timeZone": "America/Chicago" }` |

Expose those routes through the current APIM API/operation configuration using its existing backend and abuse
protection. No direct GeoNames CSP origin is needed. Keep any gateway subscription/security requirements in place.
Protected Panchang/Good Time endpoints retain their existing authorization.

The library uses a typed provider abstraction backed by an HTTPS HttpClient with a fixed GeoNames host, redirects
disabled, a timeout, cancellation and a bounded 500-entry in-process cache. It limits provider concurrency, returns
generic dependency errors and applies quota cooldowns from Retry-After/provider quota statuses. It disables HTTP
request logging for this client so precise coordinates/account IDs are not logged there. The host should retain its
existing telemetry redaction for dependency URL query strings.

## Account setup and coverage

Register a dedicated account on [GeoNames](https://www.geonames.org/login), enable its web services in the account
settings, and configure the existing API process with `GeoNames__Username`. Do not use the demo account. Optional
server settings are `GeoNames__TimeoutSeconds`, `GeoNames__SearchCacheHours`, and `GeoNames__CoordinateCacheDays`.
Username validation runs at registration/startup; missing or demo usernames are rejected. No username is hardcoded.

After a real username is provided, verify city, postal, nearby-place and timezone requests against
`https://secure.geonames.org` through the proxy in the target environment before enabling the frontend. Account-specific
secure-service access has not been verified without that account. The provider chooses `name_startsWith` for autocomplete,
`q` for broader/fallback searches, `postalCodeSearchJSON`, `findNearbyPlaceNameJSON`, and `timezoneJSON`.

GeoNames documents incomplete postal coverage: Canada, Ireland and Malta only have partial codes; Brazil contains
major codes, and Argentina's dataset uses older codes. With an explicit Canada filter, the proxy reduces a full Canadian
code to its documented FSA. Other unmatched full codes return no provider matches and the UI suggests a country, city
or coordinates. Empty provider results do not establish that a postal code is invalid worldwide.
[GeoNames service documentation](https://www.geonames.org/export/web-services.html) describes these restrictions.

Free service credits are limited, not unlimited production capacity. Confirm the account's current hourly/daily limits
and expected traffic with [GeoNames' usage overview](https://www.geonames.org/export/). Client/server caching and debounce
reduce calls, but they do not eliminate the quota. Provider quota errors are returned as 429 with a conservative retry
delay; see [GeoNames error codes](https://www.geonames.org/export/webservice-exception.html).

The enhanced location chooser discloses that search terms and selected coordinates travel through the API to GeoNames;
recent locations stay on-device. Search-history query caches are bounded, memory-only, and are excluded from persistent
Today caching. Provider failures never silently choose another place or timezone.

## Verification

`npm run location:proxy:test` builds and tests the provider with mocked HTTP responses, without GeoNames credentials
or live requests. Shared tests cover international postal formats, ambiguity, Unicode/country keys, coordinate precision,
timezone validation, reverse failure, provider errors and cache reuse. Web tests cover keyboard selection, debounce,
country filtering, clearing, quota retry and accessibility. Native tests cover touch selection and postal country filters.
Existing UI regressions run with the feature off. Physical Android/iOS/foldable-device testing and live account checks
remain rollout steps after backend integration.
