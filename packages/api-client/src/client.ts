import {
  type AddSavedLocation,
  bestGoodTimesResponseSchema,
  type ContactRequest,
  contactResponseSchema,
  type DashaSystem,
  daySummariesResponseSchema,
  festivalsResponseSchema,
  geographyOptionsSchema,
  glossaryResponseSchema,
  goodTimeExplanationResponseSchema,
  goodTimesResponseSchema,
  type KundaliAlerts,
  kundaliAlertsSchema,
  type KundaliAlertSubscriptionRequest,
  type KundaliAshtakavarga,
  kundaliAshtakavargaSchema,
  type KundaliBala,
  kundaliBalaSchema,
  type KundaliCapabilities,
  kundaliCapabilitiesSchema,
  type KundaliDashaTimeline,
  kundaliDashaTimelineSchema,
  type KundaliOverview,
  kundaliOverviewSchema,
  type KundaliPlanets,
  kundaliPlanetsSchema,
  type KundaliTransitsSection,
  kundaliTransitsSectionSchema,
  type KundaliYogas,
  kundaliYogasSchema,
  locationReverseResponseSchema,
  locationSchema,
  locationSearchResponseSchema,
  locationTimezoneResponseSchema,
  muhurtaActivitiesResponseSchema,
  muhurtaNakshatrasResponseSchema,
  panchangResponseSchema,
  panchangTraditionsResponseSchema,
  type ProfileUpdate,
  type ReplaceVedicProfileRequest,
  savedLocationSchema,
  type SaveSettings,
  traditionsResponseSchema,
  userInfoSchema,
  userProfileSchema,
  userSettingsSchema,
  type VedicProfile,
  type VedicProfileRequest,
  vedicProfileSchema,
  type VedicProfileSummary,
  vedicProfileSummarySchema,
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
      /**
       * Completes sign-in: registers the account if necessary, records the session's login once and returns the user's
       * ID, display name, email and names. Call it once per session (the session audit does); there is no separate
       * user-info request.
       */
      login: (call?: CallOptions) =>
        transport.request({
          operation: 'auth.login',
          method: 'POST',
          path: path('authLogin'),
          // The backend reads no body, but the API gateway rejects a POST without a Content-Type (415), so send `{}`.
          body: {},
          schema: userInfoSchema,
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
    },
    contact: {
      // Contact operations remain separate from authenticated preference operations.
      /** Sends the Contact Us form. The access token is attached when the visitor is signed in. */
      submit: (request: ContactRequest, call?: CallOptions) =>
        transport.request({
          operation: 'contact.submit',
          method: 'POST',
          path: path('contactSubmit'),
          body: {
            email: request.email,
            reason: request.reason,
            phoneNumber: request.phoneNumber || null,
            subject: request.subject?.trim() || request.reason,
            message: request.message,
            type:
              request.reason === 'feedback'
                ? 'Feedback'
                : request.reason === 'technical'
                  ? 'ReportIssue'
                  : 'ContactUs',
          },
          schema: contactResponseSchema,
          signal: call?.signal,
          timeoutMs: 45000,
          auth: 'optional',
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
    /**
     * Vedic Profiles: the caller's own profiles only. A foreign or missing id is a 404, deliberately indistinguishable
     * from "not found". Replace requires the revision the client last saw; a stale one surfaces as ApiError kind
     * 'conflict' (409) and must not be retried without re-reading.
     */
    /**
     * KUN-05: the computed overview for one owned Astro Profile. Read-only, and the ONLY source of the values shown -
     * the UI never recomputes them. A foreign or missing profile id is a 404, deliberately indistinguishable from
     * "not found"; 503 means the calculation engine was unavailable, which the overview renders as an explained
     * unavailable state rather than an error page.
     */
    kundali: {
      overview: (profileId: string, call?: CallOptions) =>
        transport.request<KundaliOverview>({
          operation: 'kundali.overview',
          path: path('kundaliOverview', { profileId }),
          schema: kundaliOverviewSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /**
       * KUN-08: planetary detail for one owned Astro Profile. Read-only, and the only source of the facts shown. 404 is
       * a foreign or missing profile; 409 is a stale input revision, which must not be presented as current; 503 is the
       * calculation engine being unavailable, which the UI turns into explained unavailable cells, not an error page.
       */
      planets: (profileId: string, call?: CallOptions) =>
        transport.request<KundaliPlanets>({
          operation: 'kundali.planets',
          path: path('kundaliPlanets', { profileId }),
          schema: kundaliPlanetsSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /**
       * KUN-09: the dasha timeline for one owned Astro Profile.
       *
       * `system` is always sent, so the response's own echo and the request agree and the UI never has to assume which
       * system it received. `at` is omitted deliberately when the caller wants the server's now — the server echoes the
       * instant it actually used, and inventing one client-side would silently describe a different moment. 404 is a
       * foreign or missing profile; 400 is a system the API does not know, which must not be retried into another
       * system's dates.
       */
      dashas: (
        profileId: string,
        options: { system: DashaSystem; at?: string | undefined },
        call?: CallOptions,
      ) =>
        transport.request<KundaliDashaTimeline>({
          operation: 'kundali.dashas',
          path: path('kundaliDashas', { profileId }),
          query: { system: options.system, at: options.at },
          schema: kundaliDashaTimelineSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /**
       * KUN-10: yoga and dosha assessments. The schema rejects an assessment whose status and conditions disagree, so a
       * malformed verdict surfaces as an ApiError instead of a row claiming a definite answer it cannot explain.
       */
      yogas: (profileId: string, call?: CallOptions) =>
        transport.request<KundaliYogas>({
          operation: 'kundali.yogas',
          path: path('kundaliYogas', { profileId }),
          schema: kundaliYogasSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /**
       * KUN-11: Ashtakavarga. Reconciliation is enforced by the schema: bindus that do not add up are rejected rather
       * than charted, since a chart of inconsistent numbers is a wrong answer, not a rendering problem.
       */
      ashtakavarga: (profileId: string, call?: CallOptions) =>
        transport.request<KundaliAshtakavarga>({
          operation: 'kundali.ashtakavarga',
          path: path('kundaliAshtakavarga', { profileId }),
          schema: kundaliAshtakavargaSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /**
       * KUN-12: Shadbala and Bhava Bala. The schema rejects a total that claims completeness while a classical
       * component is missing, so a silently-partial Shadbala cannot reach the UI as a complete reading.
       */
      bala: (profileId: string, call?: CallOptions) =>
        transport.request<KundaliBala>({
          operation: 'kundali.bala',
          path: path('kundaliBala', { profileId }),
          schema: kundaliBalaSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /**
       * KUN-20: the published capability boundary. Account-independent reference data — the endpoint takes no profile
       * and the response is identical for every caller, so the cache key deliberately omits user and profile.
       */
      capabilities: (call?: CallOptions) =>
        transport.request<KundaliCapabilities>({
          operation: 'kundali.capabilities',
          path: path('kundaliCapabilities'),
          schema: kundaliCapabilitiesSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /**
       * KUN-13: dated transits, Sade Sati and nullable graha positions. The schema preserves nulls, so an unevaluated
       * graha stays absent instead of arriving as a fabricated zero.
       */
      transits: (profileId: string, call?: CallOptions) =>
        transport.request<KundaliTransitsSection>({
          operation: 'kundali.transits',
          path: path('kundaliTransits', { profileId }),
          schema: kundaliTransitsSectionSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /** KUN-13: read the profile's alert subscriptions. An empty list is a real answer. */
      alerts: (profileId: string, call?: CallOptions) =>
        transport.request<KundaliAlerts>({
          operation: 'kundali.alerts',
          path: path('kundaliAlerts', { profileId }),
          schema: kundaliAlertsSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      /** KUN-13: replace this profile's subscriptions. The response is the new state, not an acknowledgement. */
      replaceAlerts: (profileId: string, request: KundaliAlertSubscriptionRequest, call?: CallOptions) =>
        transport.request<KundaliAlerts>({
          operation: 'kundali.replaceAlerts',
          method: 'PUT',
          path: path('kundaliAlerts', { profileId }),
          body: request,
          schema: kundaliAlertsSchema,
          signal: call?.signal,
          auth: 'required',
        }),
    },
    vedicProfiles: {
      list: (call?: CallOptions) =>
        transport.request<VedicProfileSummary[]>({
          operation: 'vedicProfiles.list',
          path: path('vedicProfiles'),
          schema: z.array(vedicProfileSummarySchema),
          signal: call?.signal,
          auth: 'required',
        }),
      get: (id: string, call?: CallOptions) =>
        transport.request<VedicProfile>({
          operation: 'vedicProfiles.get',
          path: path('vedicProfile', { id }),
          schema: vedicProfileSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      create: (request: VedicProfileRequest, call?: CallOptions) =>
        transport.request<VedicProfile>({
          operation: 'vedicProfiles.create',
          method: 'POST',
          path: path('vedicProfiles'),
          body: request,
          schema: vedicProfileSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      replace: (id: string, request: ReplaceVedicProfileRequest, call?: CallOptions) =>
        transport.request<VedicProfile>({
          operation: 'vedicProfiles.replace',
          method: 'PUT',
          path: path('vedicProfile', { id }),
          body: request,
          schema: vedicProfileSchema,
          signal: call?.signal,
          auth: 'required',
        }),
      // 204 No Content: the transport yields undefined, so this resolves to undefined rather than a parsed body.
      remove: (id: string, call?: CallOptions) =>
        transport.request<undefined>({
          operation: 'vedicProfiles.remove',
          method: 'DELETE',
          path: path('vedicProfile', { id }),
          schema: z.undefined(),
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
