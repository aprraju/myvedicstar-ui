import {
  type BestGoodTimesParams,
  type GoodTimesParams,
  type PanchangParams,
  queryKeys,
} from '@myvedicstar/api-client';
import type { LocalDate } from '@myvedicstar/date-time';
import {
  buildDayDashboardForDay,
  monthRange,
  panchangLocationParams,
  type YearMonth,
  yearMonthOf,
} from '@myvedicstar/domain-models';
import {
  panchangMonthOptions,
  scopedKey,
  useGoodTime,
  useLocalDate,
  useRefreshAtWindowEnd,
} from '@myvedicstar/query-cache';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '../../shared/auth';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
import { useNow } from '../../shared/hooks/useNow';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useServices } from '../../shared/services/ServicesContext';
import { useLocationState } from '../location';
import { useTradition } from '../tradition';

/** Pause after the last change before requesting, so rapid repeated selections send one request. */
const SELECTION_SETTLE_MS = 200;

/** What the user asked for: a date (location's today when omitted), an activity and, for Other, a description. */
interface GoodTimeSelection {
  date?: string | undefined;
  activity: string;
  otherText?: string | undefined;
  nakshatra?: string | undefined;
}

/** The activity cards (`/muhurta/activities`) in the UI language, with the tradition's regional names. */
export function useMuhurtaActivities() {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const { tradition } = useTradition();
  const { language } = useTranslation();
  return useQuery({
    queryKey: scopedKey(queryKeys.muhurta.activities(tradition, language), user?.id ?? null, config.cache),
    queryFn: ({ signal }) => api.muhurta.activities({ tradition, language }, { signal }),
    enabled: isAuthenticated && !loading,
  });
}

export function useMuhurtaNakshatras() {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  return useQuery({
    queryKey: scopedKey(queryKeys.muhurta.nakshatras, user?.id ?? null, config.cache),
    queryFn: ({ signal }) => api.muhurta.nakshatras({ signal }),
    enabled: isAuthenticated && !loading,
  });
}

function useGoodTimeParams(selection: GoodTimeSelection | null): GoodTimesParams | null {
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const { language } = useTranslation();
  const settled = selection;

  return useMemo(() => {
    if (!location || !settled) return null;
    // Other needs a description before anything can be evaluated.
    if (settled.activity === 'other' && !settled.otherText?.trim()) return null;
    const base: PanchangParams = { location: panchangLocationParams(location), tradition, language };
    return {
      ...base,
      date: settled.date,
      activity: settled.activity,
      nakshatra: settled.nakshatra,
      otherText: settled.otherText,
    };
  }, [location, tradition, language, settled]);
}

/**
 * The backend evaluation of a day for an activity (`/muhurta/good-times`). Location, tradition, language, date,
 * activity and the Other description are all in the query key; the previous result stays on screen (marked as
 * updating) while a new selection loads, so the page never blanks out.
 */
export function useGoodTimes(selection: GoodTimeSelection | null) {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);
  const params = useGoodTimeParams(selection);
  const query = useGoodTime({
    api,
    params,
    userId: user?.id ?? null,
    settings: config.cache,
    enabled: isAuthenticated && !loading && JSON.stringify(selection) === JSON.stringify(settled),
  });
  return { query, params };
}

/** The "In brief" narrative for the same evaluation (`/muhurta/good-times/explanation`). Optional: never blocks. */
export function useGoodTimeExplanation(params: GoodTimesParams | null, enabled: boolean) {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const today = useLocalDate(params?.location.timeZone);
  const resolved = params ? { ...params, date: params.date ?? today } : null;
  return useQuery({
    queryKey: scopedKey(
      resolved ? queryKeys.muhurta.explanation(resolved) : ['muhurta', 'explanation', 'idle'],
      user?.id ?? null,
      config.cache,
    ),
    queryFn: ({ signal }) => api.muhurta.explanation(params as GoodTimesParams, { signal }),
    enabled: enabled && params !== null && isAuthenticated && !loading,
    retry: false,
  });
}

/** Location, tradition and language for the multi-day queries; null until a location is chosen. */
function useBaseParams(): PanchangParams | null {
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const { language } = useTranslation();
  return useMemo(
    () => (location ? { location: panchangLocationParams(location), tradition, language } : null),
    [location, tradition, language],
  );
}

/** Other needs a description before anything can be evaluated. */
const isComplete = (activity: string, otherText: string | undefined) =>
  activity !== 'other' || Boolean(otherText?.trim());

/** The backend's status of every day of a month for an activity (`/muhurta/day-summaries`). */
export function useGoodTimeMonth(
  selection: {
    yearMonth: YearMonth;
    activity: string;
    otherText?: string | undefined;
    nakshatra?: string | undefined;
  } | null,
) {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const base = useBaseParams();
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);
  const request = useMemo(() => {
    if (!base || !selection || !isComplete(selection.activity, selection.otherText)) return null;
    const { start, days } = monthRange(selection.yearMonth);
    return {
      start,
      days,
      params: {
        ...base,
        activity: selection.activity,
        nakshatra: selection.nakshatra,
        otherText: selection.otherText,
      },
    };
  }, [base, selection]);

  return useQuery({
    queryKey: scopedKey(
      request
        ? queryKeys.muhurta.daySummaries(request.start, request.days, request.params)
        : ['muhurta', 'day-summaries', 'idle'],
      user?.id ?? null,
      config.cache,
    ),
    queryFn: ({ signal }) => {
      const { start, days, params } = request as NonNullable<typeof request>;
      return api.muhurta.daySummaries(start, days, params, { signal });
    },
    enabled:
      request !== null &&
      isAuthenticated &&
      !loading &&
      JSON.stringify(selection) === JSON.stringify(settled),
  });
}

/** The next best Good Times for an activity (`/muhurta/good-times/best`): one per day, best first. */
export function useBestGoodTimes(
  selection: {
    activity: string;
    otherText?: string | undefined;
    nakshatra?: string | undefined;
    /** Days searched from today (the backend's default, 30, when omitted). */
    days?: number | undefined;
  } | null,
) {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const base = useBaseParams();
  const today = useLocalDate(base?.location.timeZone);
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);
  const params: BestGoodTimesParams | null = useMemo(() => {
    if (!base || !selection || !isComplete(selection.activity, selection.otherText)) return null;
    return {
      ...base,
      activity: selection.activity,
      nakshatra: selection.nakshatra,
      otherText: selection.otherText,
      count: BEST_COUNT,
      days: selection.days,
    };
  }, [base, selection]);

  const query = useQuery({
    queryKey: scopedKey(
      params ? [...queryKeys.muhurta.bestGoodTimes(params), today] : ['muhurta', 'best', 'idle'],
      user?.id ?? null,
      config.cache,
    ),
    queryFn: ({ signal }) => api.muhurta.bestGoodTimes(params as BestGoodTimesParams, { signal }),
    enabled:
      params !== null && isAuthenticated && !loading && JSON.stringify(selection) === JSON.stringify(settled),
  });
  useRefreshAtWindowEnd(query.data, query.refetch, params !== null && isAuthenticated && !loading);
  return query;
}

/** How many options the "Next best days" tile shows. */
export const BEST_COUNT = 3;

/**
 * Date-based best windows are returned authoritatively by day-summaries; /best searches only from today. `days` is the
 * searched range (30 when omitted; the phone layout offers 60 and 90).
 */
export function useBestGoodTimeWindows(
  selection: {
    date: string;
    days?: number | undefined;
    activity: string;
    otherText?: string | undefined;
    nakshatra?: string | undefined;
  } | null,
) {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const base = useBaseParams();
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);
  const request = useMemo(
    () =>
      base && selection && isComplete(selection.activity, selection.otherText)
        ? {
            start: selection.date,
            days: selection.days ?? 30,
            params: {
              ...base,
              activity: selection.activity,
              otherText: selection.otherText,
              nakshatra: selection.nakshatra,
            },
          }
        : null,
    [base, selection],
  );
  const query = useQuery({
    queryKey: scopedKey(
      request
        ? queryKeys.muhurta.daySummaries(request.start, request.days, request.params)
        : ['muhurta', 'date-best', 'idle'],
      user?.id ?? null,
      config.cache,
    ),
    queryFn: ({ signal }) => {
      const { start, days, params } = request as NonNullable<typeof request>;
      return api.muhurta.daySummaries(start, days, params, { signal });
    },
    enabled:
      request !== null &&
      isAuthenticated &&
      !loading &&
      JSON.stringify(selection) === JSON.stringify(settled),
  });
  return { query, start: request?.start };
}

/**
 * One day's Panchang view model (timeline, auspicious times, times to avoid, rating factors) for "Day at a glance".
 * Reads the same month query as the Panchang calendar (`GET /panchang/month/{year}/{month}`), so the two pages share
 * one cache entry; nothing is requested until `enabled`.
 */
export function useDayPanchang(date: LocalDate | undefined, enabled: boolean) {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const client = useQueryClient();
  const base = useBaseParams();
  const now = useNow();
  const { year, month } = yearMonthOf(date ?? '1970-01-01');
  const query = useQuery(
    panchangMonthOptions(
      {
        api,
        params: base,
        userId: user?.id ?? null,
        enabled: enabled && date !== undefined && isAuthenticated && !loading,
        settings: config.cache,
      },
      client,
      year,
      month,
    ),
  );
  const day = query.data?.days.find((item) => item.date === date);
  const timeZone = base?.location.timeZone;
  const dashboard = useMemo(
    () => (day && timeZone ? buildDayDashboardForDay(day, timeZone, now) : undefined),
    [day, timeZone, now],
  );
  return { query, dashboard, glossary: query.data?.glossary };
}
