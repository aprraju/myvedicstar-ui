/**
 * API endpoint catalog. Paths are relative to `apiBaseUrl` (which includes the version, e.g.
 * `http://localhost:5275/api/v1`) and may be overridden per environment in runtime configuration (`endpoints`).
 * Defaults mirror the MyVedicDay OpenAPI document (`/openapi/v1.json`, operationIds in comments).
 */
export const defaultApiEndpoints = {
  /** GetTraditions */
  traditions: '/traditions',
  /** GetGlossary */
  glossary: '/panchang/glossary',
  /** GetPanchangTraditions */
  panchangTraditions: '/panchang/traditions',
  /** GetPanchangToday */
  panchangToday: '/panchang/today',
  /** GetPanchangTomorrow */
  panchangTomorrow: '/panchang/tomorrow',
  /** GetPanchangTenDays */
  panchangTenDays: '/panchang/ten-days',
  /** GetPanchangRange */
  panchangRange: '/panchang/range',
  /** GetPanchangMonth */
  panchangMonth: '/panchang/month/{year}/{month}',
  /** GetPanchangYear */
  panchangYear: '/panchang/year/{year}',
  /** GetPanchangForDate */
  panchangDate: '/panchang/{date}',
  /** ResolveLocation */
  locationsResolve: '/locations/resolve',
  locationsSearch: '/locations/search',
  locationsPostal: '/locations/postal',
  locationsReverse: '/locations/reverse',
  locationsTimezone: '/locations/timezone',
  locationsCountries: '/locations/countries',
  locationsRegions: '/locations/regions',
  locationsAddressCities: '/locations/address-cities',
  /** GetUpcomingFestivals */
  festivalsUpcoming: '/festivals/upcoming',
  /** GetMuhurtaActivities */
  muhurtaActivities: '/muhurta/activities',
  muhurtaNakshatras: '/muhurta/nakshatras',
  /** GetGoodTimes */
  muhurtaGoodTimes: '/muhurta/good-times',
  /** GetGoodTimesExplanation */
  muhurtaExplanation: '/muhurta/good-times/explanation',
  /** GetMuhurtaDaySummaries */
  muhurtaDaySummaries: '/muhurta/day-summaries',
  /** GetBestGoodTimes */
  muhurtaBestGoodTimes: '/muhurta/good-times/best',
  /**
   * MyVedicStar.Authorize.Api — POST, completes sign-in and returns the user's ID, display name, email and names. Same
   * base URL: API Management routes it (development: the Vite dev server proxies `/api/v1/auth` to the Authorize API).
   */
  authLogin: '/auth/login',
  authLogout: '/auth/logout',
  authProfile: '/auth/profile',
  authProfileSync: '/auth/profile/sync',
  userSettings: '/settings',
  savedLocations: '/settings/locations',
  savedLocation: '/settings/locations/{locationId}',
  /** Contact Us form submission (POST). */
  contactSubmit: '/email/send',
  /** Vedic Profiles — owned CRUD (list/create, read/replace/delete by id). */
  vedicProfiles: '/vedic-profiles',
  vedicProfile: '/vedic-profiles/{id}',
  /** KUN-05: the computed overview for one owned Astro Profile. Read-only. */
  kundaliOverview: '/kundali/{profileId}/overview',
  /** KUN-08: planetary detail, dignity and aspects for one owned Astro Profile. Read-only. */
  kundaliPlanets: '/kundali/{profileId}/sections/planets',
  /** KUN-09: dasha timeline for one owned Astro Profile. Read-only; `system` and `at` are query parameters. */
  kundaliDashas: '/kundali/{profileId}/sections/dashas',
  /** KUN-10: yoga and dosha assessments for one owned Astro Profile. Read-only. */
  kundaliYogas: '/kundali/{profileId}/sections/yogas',
  /** KUN-11: Bhinnashtakavarga and Sarvashtakavarga for one owned Astro Profile. Read-only. */
  kundaliAshtakavarga: '/kundali/{profileId}/sections/ashtakavarga',
  /** KUN-12: Shadbala and Bhava Bala for one owned Astro Profile. Read-only. */
  kundaliBala: '/kundali/{profileId}/sections/bala',
  /** KUN-20: the published capability boundary. Account-independent reference data. */
  kundaliCapabilities: '/kundali/capabilities',
} as const;

export type ApiEndpointName = keyof typeof defaultApiEndpoints;
export type ApiEndpoints = Record<ApiEndpointName, string>;

/** Placeholders each endpoint must contain — no more, no fewer. */
export const endpointPlaceholders: Record<ApiEndpointName, readonly string[]> = {
  traditions: [],
  glossary: [],
  panchangTraditions: [],
  panchangToday: [],
  panchangTomorrow: [],
  panchangTenDays: [],
  panchangRange: [],
  panchangMonth: ['year', 'month'],
  panchangYear: ['year'],
  panchangDate: ['date'],
  locationsResolve: [],
  locationsSearch: [],
  locationsPostal: [],
  locationsReverse: [],
  locationsTimezone: [],
  locationsCountries: [],
  locationsRegions: [],
  locationsAddressCities: [],
  festivalsUpcoming: [],
  muhurtaActivities: [],
  muhurtaNakshatras: [],
  muhurtaGoodTimes: [],
  muhurtaExplanation: [],
  muhurtaDaySummaries: [],
  muhurtaBestGoodTimes: [],
  authLogin: [],
  authLogout: [],
  authProfile: [],
  authProfileSync: [],
  userSettings: [],
  savedLocations: [],
  savedLocation: ['locationId'],
  contactSubmit: [],
  vedicProfiles: [],
  vedicProfile: ['id'],
  kundaliOverview: ['profileId'],
  kundaliPlanets: ['profileId'],
  kundaliDashas: ['profileId'],
  kundaliYogas: ['profileId'],
  kundaliAshtakavarga: ['profileId'],
  kundaliBala: ['profileId'],
  kundaliCapabilities: [],
};

const TEMPLATE_PATTERN = /^\/[A-Za-z0-9_\-./{}]*$/;

/**
 * Returns a problem description, or undefined when the template is safe: relative to the base URL (so configuration
 * can never send requests to another host), no `..` segments, and exactly the required placeholders.
 */
export function validateEndpointTemplate(name: ApiEndpointName, template: string): string | undefined {
  if (!TEMPLATE_PATTERN.test(template) || template.startsWith('//')) {
    return 'must be a path relative to apiBaseUrl, e.g. "/panchang/today"';
  }
  if (template.split('/').some((segment) => segment === '..' || segment === '.')) {
    return 'must not contain "." or ".." segments';
  }
  const found = [...template.matchAll(/\{([A-Za-z]+)\}/g)].map((m) => m[1]).sort();
  const expected = [...endpointPlaceholders[name]].sort();
  if (found.join(',') !== expected.join(',') || /[{}]/.test(template.replace(/\{[A-Za-z]+\}/g, ''))) {
    return expected.length
      ? `must contain exactly the placeholders ${expected.map((p) => `{${p}}`).join(', ')}`
      : 'must not contain placeholders';
  }
  return undefined;
}

/** Fills `{placeholders}` with URL-encoded values, e.g. ("/panchang/{date}", {date: "2026-09-29"}). */
export function expandEndpoint(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{([A-Za-z]+)\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Missing value for {${key}} in ${template}`);
    return encodeURIComponent(String(value));
  });
}
