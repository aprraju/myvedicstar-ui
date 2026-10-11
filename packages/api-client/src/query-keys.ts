import type {
  BestGoodTimesParams,
  DaySummariesParams,
  GoodTimesParams,
  LocationParams,
  PanchangParams,
} from './client';

/**
 * Query keys for every cached read. Location, tradition and language are part of each Panchang key so data for one
 * place, tradition or language is never shown for another.
 */
export const queryKeys = {
  panchang: {
    all: ['panchang'] as const,
    today: (params: PanchangParams) => ['panchang', 'today', normalize(params)] as const,
    date: (date: string, params: PanchangParams) => ['panchang', 'date', date, normalize(params)] as const,
    tenDays: (params: PanchangParams) => ['panchang', 'ten-days', normalize(params)] as const,
    month: (year: number, month: number, params: PanchangParams) =>
      ['panchang', 'month', year, month, normalize(params)] as const,
    year: (year: number, params: PanchangParams) => ['panchang', 'year', year, normalize(params)] as const,
    traditions: (language: string | undefined) => ['panchang', 'traditions', language ?? null] as const,
    glossary: (tradition: string | undefined, language: string | undefined) =>
      ['panchang', 'glossary', tradition ?? null, language ?? null] as const,
  },
  locations: {
    resolve: (location: LocationParams) => ['locations', 'resolve', normalizeLocation(location)] as const,
  },
  traditions: {
    list: (language: string | undefined) => ['traditions', 'list', language ?? null] as const,
  },
  festivals: {
    upcoming: (params: PanchangParams, days: number) =>
      ['festivals', 'upcoming', days, normalize(params)] as const,
  },
  muhurta: {
    nakshatras: ['muhurta', 'nakshatras'] as const,
    activities: (tradition: string | undefined, language: string | undefined) =>
      ['muhurta', 'activities', tradition ?? null, language ?? null] as const,
    /** Location, tradition, language, date, activity and (for Other) the text are all part of the key. */
    goodTimes: (params: GoodTimesParams) => ['muhurta', 'good-times', goodTimesKey(params)] as const,
    explanation: (params: GoodTimesParams) => ['muhurta', 'explanation', goodTimesKey(params)] as const,
    daySummaries: (start: string, days: number, params: DaySummariesParams) =>
      [
        'muhurta',
        'day-summaries',
        start,
        days,
        params.activity ?? null,
        otherTextKey(params.activity, params.otherText),
        params.nakshatra?.trim().toLowerCase() || null,
        normalize(params),
      ] as const,
    bestGoodTimes: (params: BestGoodTimesParams) =>
      [
        'muhurta',
        'best',
        {
          ...normalize(params),
          activity: params.activity ?? null,
          otherText: otherTextKey(params.activity, params.otherText),
          nakshatra: params.nakshatra?.trim().toLowerCase() || null,
          count: params.count ?? null,
          days: params.days ?? null,
        },
      ] as const,
  },
  auth: {
    /** Per signed-in user, so another user's profile is never shown. */
    userInfo: (userId: string) => ['auth', 'userinfo', userId] as const,
  },
} as const;

function normalize({ location, tradition, language }: PanchangParams) {
  return { location: normalizeLocation(location), tradition: tradition ?? null, language: language ?? null };
}

function goodTimesKey(params: GoodTimesParams) {
  return {
    ...normalize(params),
    date: params.date ?? null,
    activity: params.activity ?? null,
    otherText: otherTextKey(params.activity, params.otherText),
    nakshatra: params.nakshatra?.trim().toLowerCase() || null,
  };
}

function otherTextKey(activity: string | undefined, otherText: string | undefined) {
  return activity === 'other' ? (otherText?.trim().toLowerCase() ?? null) : null;
}

function normalizeLocation(location: LocationParams) {
  return {
    place: location.place?.trim().toLowerCase() ?? null,
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    timeZone: location.timeZone ?? null,
  };
}
