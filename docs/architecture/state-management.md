# State management

| Kind              | Tool                                     | Examples                                                                                                                    | Rule                                   |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Server state      | TanStack Query                           | Panchang day/month/year, traditions, resolved location                                                                      | Never copied into other stores         |
| Application state | React context (small, focused)           | authenticated user (`AuthClient` via `useSyncExternalStore`), appearance, language; selected location & tradition (Phase 2) | Only what unrelated routes share       |
| UI state          | `useState` / `useReducer`                | open panels, selected tab, pending button                                                                                   | Local to the component                 |
| Form state        | React Hook Form + Zod resolver (Phase 2) | location search, coordinates form, Good Time request                                                                        | Schemas from `@myvedicstar/validation` |
| URL state         | React Router search params               | selected date, returnTo, filters                                                                                            | Shareable, deep-linkable               |

No global store library is used: the few truly global values are small contexts. Add one (e.g. Zustand) only if a
concrete need appears.

## Query keys and freshness

`queryKeys` (`@myvedicstar/api-client`) include **date, location, tradition and language** so data for one context is
never shown for another. Defaults (`shared/services/query-client.ts`):

- `staleTime` 5 min, `gcTime` 30 min, `refetchOnWindowFocus: false` (Panchang for a date does not change).
- Retries: `shouldRetryQuery` — network, timeout, 429 and 502/503/504 only, max 2, exponential backoff with jitter,
  honouring `Retry-After`. Mutations: never retried automatically.
- "Today" rolls over at the **location's** midnight: `msUntilNextLocalDay(timeZone)` (`@myvedicstar/date-time`)
  schedules the refetch; the backend's `localToday` confirms the day changed. Implemented with the Today feature.

## Persistence

Browser `localStorage` holds only non-sensitive preferences (appearance now; recent locations and tradition in
Phase 2), always validated on read. Tokens are never persisted in browser storage. Mobile will use
AsyncStorage for preferences and `expo-secure-store` (Keychain/Keystore) for tokens.
