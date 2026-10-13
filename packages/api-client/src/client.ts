import {
  type AddSavedLocation,
  bestGoodTimesResponseSchema,
  type ContactRequest,
  contactResponseSchema,
  daySummariesResponseSchema,
  festivalsResponseSchema,
  geographyOptionsSchema,
  glossaryResponseSchema,
  goodTimeExplanationResponseSchema,
  goodTimesResponseSchema,
  locationReverseResponseSchema,
  locationSchema,
  locationSearchResponseSchema,
  locationTimezoneResponseSchema,
  muhurtaActivitiesResponseSchema,
  muhurtaNakshatrasResponseSchema,
  panchangResponseSchema,
  panchangTraditionsResponseSchema,
  type ProfileUpdate,
  savedLocationSchema,
  type SaveSettings,
  traditionsResponseSchema,
  userInfoSchema,
  userProfileSchema,
  userSettingsSchema,
} from '@myvedicstar/contracts';
import { z } from 'zod';

import {
  type ApiEndpointName,
  type ApiEndpoints,
  defaultApiEndpoints,
  expandEndpoint,
  validateEndpointTemplate,
} from './endpoints';
import {
  createHttpTransport,
  type HttpTransport,
  type HttpTransportOptions,
  type QueryValue,
} from './transport';

/**
 * A location as the backend accepts it: a place (`City, State[, Country]`), coordinates, or a place disambiguated by
 * coordinates. `timeZone` is optional; the location's own zone always wins on the server.
 */
export interface LocationParams {
  place?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  timeZone?: string | undefined;
}

export interface PanchangParams {
  location: LocationParams;
  tradition?: string | undefined;
  language?: string | undefined;
}

/** What to evaluate in Find a Good Time. */
export interface GoodTimesParams extends PanchangParams {
  /** Local date `yyyy-MM-dd`; the location's today when omitted. */
  date?: string | undefined;
  /** Activity key from `/muhurta/activities`; `general` when omitted. */
  activity?: string | undefined;
  /** Required with `activity: 'other'`. */
  otherText?: string | undefined;
  /** Optional birth star name from the Nakshatra catalog. */
  nakshatra?: string | undefined;
}

/** What to search in "Next best times". */
export interface BestGoodTimesParams extends PanchangParams {
  /** Activity key; `general` when omitted. */
  activity?: string | undefined;
  /** Required with `activity: 'other'`. */
  otherText?: string | undefined;
  /** Optional birth star name from the Nakshatra catalog. */
  nakshatra?: string | undefined;
  /** Number of options, 1–10; 3 when omitted. */
  count?: number | undefined;
  /** Days searched from today at the location, 1–90; 30 when omitted. */
  days?: number | undefined;
}

/** An activity for a range of day summaries (a month view). */
export interface DaySummariesParams extends PanchangParams {
  activity?: string | undefined;
  /** Required with `activity: 'other'`. */
  otherText?: string | undefined;
  /** Optional birth star name from the Nakshatra catalog. */
  nakshatra?: string | undefined;
}

export interface CallOptions {
  signal?: AbortSignal | undefined;
}

export interface LocationSearchParams {
  text: string;
  country?: string | undefined;
  language?: string | undefined;
  maxRows?: number | undefined;
}

export interface ApiClientOptions extends HttpTransportOptions {
  /**
   * Decimal places sent for coordinates. Matches the backend's `Location:CoordinateDecimalPlaces` (2 ≈ 1 km), so the
   * UI never transmits more precision than the calculation uses and cache keys stay stable.
   */
  coordinateDecimals?: number | false;
  /** Endpoint paths from runtime configuration; missing entries use the defaults from the OpenAPI document. */
  endpoints?: Partial<ApiEndpoints> | undefined;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Typed endpoints of the MyVedicDay API. Requests attach the signed-in user's access token.
 * Only today's Panchang and location resolve allow anonymous requests; all other endpoints require a token.
 * `baseUrl` includes the API version prefix, e.g. `https://api.example.com/api/v1`;
 * endpoint paths come from configuration (see ./endpoints.ts). UI code reaches the backend only through this client.
 */
export function createApiClient(options: ApiClientOptions) {
  const transport: HttpTransport = createHttpTransport(options);
  const decimals = options.coordinateDecimals ?? 2;
  const endpoints = resolveEndpoints(options.endpoints);
  const path = (name: ApiEndpointName, values?: Record<string, string | number>) =>
    expandEndpoint(endpoints[name], values);

  const panchangQuery = ({ location, tradition, language }: PanchangParams): Record<string, QueryValue> => ({
    ...locationQuery(location, decimals),
    tradition,
    language,
  });

  const goodTimesQuery = (params: GoodTimesParams): Record<string, QueryValue> => ({
    ...panchangQuery(params),
    date: params.date,
    activity: params.activity,
    otherText: otherTextFor(params.activity, params.otherText),
    nakshatra: params.nakshatra?.trim() || undefined,
  });

  const otherTextFor = (activity: string | undefined, otherText: string | undefined) =>
    activity === 'other' ? otherText?.trim() : undefined;

  const getPanchang = (
    operation: string,
    requestPath: string,
    params: PanchangParams,
    call?: CallOptions,
    extra?: Record<string, QueryValue>,
  ) =>
    transport.request({
      operation,
      path: requestPath,
      query: { ...panchangQuery(params), ...extra },
      schema: panchangResponseSchema,
      signal: call?.signal,
      auth: 'required',
    });

  return {
    panchang: {
      today: (params: PanchangParams, call?: CallOptions) =>
        getPanchang('panchang.today', path('panchangToday'), params, call),
      tomorrow: (params: PanchangParams, call?: CallOptions) =>
        getPanchang('panchang.tomorrow', path('panchangTomorrow'), params, call),
      tenDays: (params: PanchangParams, call?: CallOptions) =>
        getPanchang('panchang.tenDays', path('panchangTenDays'), params, call),
      /** One local date, `yyyy-MM-dd`. */
      date: (date: string, params: PanchangParams, call?: CallOptions) =>
        getPanchang('panchang.date', path('panchangDate', { date }), params, call),
      /** `days` consecutive dates (1–366) from `start` (`yyyy-MM-dd`). */
      range: (start: string, days: number, params: PanchangParams, call?: CallOptions) =>
        getPanchang('panchang.range', path('panchangRange'), params, call, { start, days }),
      month: (year: number, month: number, params: PanchangParams, call?: CallOptions) =>
        getPanchang('panchang.month', path('panchangMonth', { year, month }), params, call),
      year: (year: number, params: PanchangParams, call?: CallOptions) =>
        getPanchang('panchang.year', path('panchangYear', { year }), params, call),
      traditions: (language?: string, call?: CallOptions) =>
        transport.request({
          operation: 'panchang.traditions',
          path: path('panchangTraditions'),
          query: { language },
          schema: panchangTraditionsResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /** Glossary for a tradition (regional period names) in a language. */
      glossary: (
        params: { tradition?: string | undefined; language?: string | undefined } = {},
        call?: CallOptions,
      ) =>
        transport.request({
          operation: 'panchang.glossary',
          path: path('glossary'),
          query: { tradition: params.tradition, language: params.language },
          schema: glossaryResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
    },
    locations: {
      countries: (call?: CallOptions) =>
        transport.request({
          operation: 'locations.countries',
          path: path('locationsCountries'),
          schema: geographyOptionsSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      regions: (country: string, call?: CallOptions) =>
        transport.request({
          operation: 'locations.regions',
          path: path('locationsRegions'),
          query: { country },
          schema: geographyOptionsSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      addressCities: (
        text: string,
        country: string | undefined,
        region: string | undefined,
        call?: CallOptions,
      ) =>
        transport.request({
          operation: 'locations.addressCities',
          path: path('locationsAddressCities'),
          query: { text, country, region },
          schema: locationSearchResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      search: (params: LocationSearchParams, call?: CallOptions) =>
        transport.request({
          operation: 'locations.search',
          path: path('locationsSearch'),
          query: { ...params },
          schema: locationSearchResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      postal: (params: LocationSearchParams, call?: CallOptions) =>
        transport.request({
          operation: 'locations.postal',
          path: path('locationsPostal'),
          query: { ...params },
          schema: locationSearchResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      reverse: (latitude: number, longitude: number, language?: string, call?: CallOptions) =>
        transport.request({
          operation: 'locations.reverse',
          path: path('locationsReverse'),
          query: { latitude, longitude, language },
          schema: locationReverseResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      timezone: (latitude: number, longitude: number, call?: CallOptions) =>
        transport.request({
          operation: 'locations.timezone',
          path: path('locationsTimezone'),
          query: { latitude, longitude },
          schema: locationTimezoneResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      resolve: (location: LocationParams, call?: CallOptions) =>
        transport.request({
          operation: 'locations.resolve',
          path: path('locationsResolve'),
          query: locationQuery(location, decimals),
          schema: locationSchema,
          signal: call?.signal,
          auth: 'required',
        }),
    },
    festivals: {
      /** Festivals and observances from the location's today for `days` days (backend default 30). */
      upcoming: (params: PanchangParams & { days?: number | undefined }, call?: CallOptions) =>
        transport.request({
          operation: 'festivals.upcoming',
          path: path('festivalsUpcoming'),
          query: { ...panchangQuery(params), days: params.days },
          schema: festivalsResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
    },
    muhurta: {
      nakshatras: (call?: CallOptions) =>
        transport.request({
          operation: 'muhurta.nakshatras',
          path: path('muhurtaNakshatras'),
          schema: muhurtaNakshatrasResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /** The activity cards for "What are you planning?", in display order. */
      activities: (
        params: { tradition?: string | undefined; language?: string | undefined } = {},
        call?: CallOptions,
      ) =>
        transport.request({
          operation: 'muhurta.activities',
          path: path('muhurtaActivities'),
          query: { tradition: params.tradition, language: params.language },
          schema: muhurtaActivitiesResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /** One day evaluated for an activity. Statuses and Good Times are authoritative: render them as given. */
      goodTimes: (params: GoodTimesParams, call?: CallOptions) =>
        transport.request({
          operation: 'muhurta.goodTimes',
          path: path('muhurtaGoodTimes'),
          query: goodTimesQuery(params),
          schema: goodTimesResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /** "Why this time?" narrative for the same evaluation (AI when enabled and valid, else template). */
      explanation: (params: GoodTimesParams, call?: CallOptions) =>
        transport.request({
          operation: 'muhurta.explanation',
          path: path('muhurtaExplanation'),
          query: goodTimesQuery(params),
          schema: goodTimeExplanationResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /** Day status per date (calendar tiles); `days` 1–366 from `start`. */
      daySummaries: (start: string, days: number, params: DaySummariesParams, call?: CallOptions) =>
        transport.request({
          operation: 'muhurta.daySummaries',
          path: path('muhurtaDaySummaries'),
          query: {
            ...panchangQuery(params),
            start,
            days,
            activity: params.activity,
            otherText: otherTextFor(params.activity, params.otherText),
            nakshatra: params.nakshatra?.trim() || undefined,
          },
          schema: daySummariesResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /** The next best Good Times (one per day, best first). Only Good Times: render them as given. */
      bestGoodTimes: (params: BestGoodTimesParams, call?: CallOptions) =>
        transport.request({
          operation: 'muhurta.bestGoodTimes',
          path: path('muhurtaBestGoodTimes'),
          query: {
            ...panchangQuery(params),
            activity: params.activity,
            otherText: otherTextFor(params.activity, params.otherText),
            nakshatra: params.nakshatra?.trim() || undefined,
            count: params.count,
            days: params.days,
          },
          schema: bestGoodTimesResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
    },
    auth: {
      profile: (call?: CallOptions) =>
        transport.request({
          operation: 'auth.profile',
          path: path('authProfile'),
          schema: userProfileSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      updateProfile: (request: ProfileUpdate, call?: CallOptions) =>
        transport.request({
          operation: 'auth.updateProfile',
          method: 'PATCH',
          path: path('authProfile'),
          body: request,
          schema: userProfileSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      retryProfileSync: (call?: CallOptions) =>
        transport.request({
          operation: 'auth.profileSync',
          method: 'POST',
          path: path('authProfileSync'),
          body: {},
          schema: userProfileSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /** Records a login audit event using the current account's access token. */
      login: (call?: CallOptions) =>
        transport.request({
          operation: 'auth.login',
          method: 'POST',
          path: path('authLogin'),
          body: {},
          schema: z.unknown(),
          signal: call?.signal,
          auth: 'required',
        }),
      /** Records logout before the current account's token is discarded. */
      logout: (call?: CallOptions) =>
        transport.request({
          operation: 'auth.logout',
          method: 'POST',
          path: path('authLogout'),
          body: {},
          schema: z.unknown(),
          signal: call?.signal,
          auth: 'required',
        }),
      /**
       * Refreshes and returns the signed-in user's profile; call it once per session. Requires the access token.
       */
      userInfo: (call?: CallOptions) =>
        transport.request({
          operation: 'auth.userInfo',
          method: 'POST',
          path: path('authUserInfo'),
          // The backend reads no body, but the API gateway rejects a POST without a Content-Type (415), so send `{}`.
          body: {},
          schema: userInfoSchema,
          signal: call?.signal,
          auth: 'required',
        }),
    },
    contact: {
      // Contact operations remain separate from authenticated preference operations.
      /** Sends the Contact Us form. The access token is attached when the visitor is signed in. */
      submit: (request: ContactRequest, call?: CallOptions) =>
        transport.request({
          operation: 'contact.submit',
          method: 'POST',
          path: path('contactSubmit'),
          body: request,
          schema: contactResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
    },
    traditions: {
      list: (language?: string, call?: CallOptions) =>
        transport.request({
          operation: 'traditions.list',
          path: path('traditions'),
          query: { language },
          schema: traditionsResponseSchema,
          signal: call?.signal,
          auth: 'required',
        }),
    },
    settings: {
      get: (call?: CallOptions) =>
        transport.request({
          operation: 'settings.get',
          path: path('userSettings'),
          schema: userSettingsSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      save: (request: SaveSettings, call?: CallOptions) =>
        transport.request({
          operation: 'settings.save',
          method: 'PUT',
          path: path('userSettings'),
          body: request,
          schema: userSettingsSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      locations: (call?: CallOptions) =>
        transport.request({
          operation: 'settings.locations',
          path: path('savedLocations'),
          schema: z.array(savedLocationSchema),
          signal: call?.signal,
          auth: 'required',
        }),
      addLocation: (request: AddSavedLocation, call?: CallOptions) =>
        transport.request({
          operation: 'settings.addLocation',
          method: 'POST',
          path: path('savedLocations'),
          body: request,
          schema: savedLocationSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      deleteLocation: (locationId: string, call?: CallOptions) =>
        transport.request({
          operation: 'settings.deleteLocation',
          method: 'DELETE',
          path: path('savedLocation', { locationId }),
          schema: userSettingsSchema,
          signal: call?.signal,
          auth: 'required',
        }),
    },
  };
}

/** Merges configured paths over the defaults, rejecting unsafe or malformed templates. */
export function resolveEndpoints(overrides: Partial<ApiEndpoints> = {}): ApiEndpoints {
  const merged: ApiEndpoints = { ...defaultApiEndpoints, ...overrides };
  for (const name of Object.keys(merged) as ApiEndpointName[]) {
    const problem = validateEndpointTemplate(name, merged[name]);
    if (problem) throw new Error(`Invalid endpoint "${name}": ${problem}`);
  }
  return merged;
}

export function roundCoordinate(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Query parameter names follow the OpenAPI document (`timeZone`, not `timezone`). */
function locationQuery(location: LocationParams, decimals: number | false): Record<string, QueryValue> {
  return {
    place: location.place?.trim(),
    latitude:
      location.latitude === undefined || decimals === false
        ? location.latitude
        : roundCoordinate(location.latitude, decimals),
    longitude:
      location.longitude === undefined || decimals === false
        ? location.longitude
        : roundCoordinate(location.longitude, decimals),
    timeZone: location.timeZone,
  };
}
