import {
  type BestGoodTimesParams,
  type GoodTimesParams,
  type PanchangParams,
  queryKeys,
} from '@myvedicstar/api-client';
import { monthRange, panchangLocationParams, type YearMonth } from '@myvedicstar/domain-models';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '../../shared/auth';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
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
  const { api } = useServices();
  const { isAuthenticated, loading } = useAuth();
  const { tradition } = useTradition();
  const { language } = useTranslation();
  return useQuery({
    queryKey: queryKeys.muhurta.activities(tradition, language),
    queryFn: ({ signal }) => api.muhurta.activities({ tradition, language }, { signal }),
    staleTime: 60 * 60_000,
    enabled: isAuthenticated && !loading,
  });
}

export function useMuhurtaNakshatras() {
  const { api } = useServices();
  const { isAuthenticated, loading } = useAuth();
  return useQuery({
    queryKey: queryKeys.muhurta.nakshatras,
    queryFn: ({ signal }) => api.muhurta.nakshatras({ signal }),
    staleTime: 60 * 60_000,
    enabled: isAuthenticated && !loading,
  });
}

function useGoodTimeParams(selection: GoodTimeSelection | null): GoodTimesParams | null {
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const { language } = useTranslation();
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);

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
  const { api } = useServices();
  const { isAuthenticated, loading } = useAuth();
  const params = useGoodTimeParams(selection);
  const query = useQuery({
    queryKey: params ? queryKeys.muhurta.goodTimes(params) : ['muhurta', 'good-times', 'idle'],
    queryFn: ({ signal }) => api.muhurta.goodTimes(params as GoodTimesParams, { signal }),
    enabled: params !== null && isAuthenticated && !loading,
    placeholderData: keepPreviousData,
  });
  return { query, params };
}

/** The "In brief" narrative for the same evaluation (`/muhurta/good-times/explanation`). Optional: never blocks. */
export function useGoodTimeExplanation(params: GoodTimesParams | null, enabled: boolean) {
  const { api } = useServices();
  const { isAuthenticated, loading } = useAuth();
  return useQuery({
    queryKey: params ? queryKeys.muhurta.explanation(params) : ['muhurta', 'explanation', 'idle'],
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
  const { api } = useServices();
  const { isAuthenticated, loading } = useAuth();
  const base = useBaseParams();
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);
  const request = useMemo(() => {
    if (!base || !settled || !isComplete(settled.activity, settled.otherText)) return null;
    const { start, days } = monthRange(settled.yearMonth);
    return {
      start,
      days,
      params: {
        ...base,
        activity: settled.activity,
        nakshatra: settled.nakshatra,
        otherText: settled.otherText,
      },
    };
  }, [base, settled]);

  return useQuery({
    queryKey: request
      ? queryKeys.muhurta.daySummaries(request.start, request.days, request.params)
      : ['muhurta', 'day-summaries', 'idle'],
    queryFn: ({ signal }) => {
      const { start, days, params } = request as NonNullable<typeof request>;
      return api.muhurta.daySummaries(start, days, params, { signal });
    },
    enabled: request !== null && isAuthenticated && !loading,
    placeholderData: keepPreviousData,
  });
}

/** The next best Good Times for an activity (`/muhurta/good-times/best`): one per day, best first. */
export function useBestGoodTimes(
  selection: { activity: string; otherText?: string | undefined; nakshatra?: string | undefined } | null,
) {
  const { api } = useServices();
  const { isAuthenticated, loading } = useAuth();
  const base = useBaseParams();
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);
  const params: BestGoodTimesParams | null = useMemo(() => {
    if (!base || !settled || !isComplete(settled.activity, settled.otherText)) return null;
    return {
      ...base,
      activity: settled.activity,
      nakshatra: settled.nakshatra,
      otherText: settled.otherText,
      count: BEST_COUNT,
    };
  }, [base, settled]);

  return useQuery({
    queryKey: params ? queryKeys.muhurta.bestGoodTimes(params) : ['muhurta', 'best', 'idle'],
    queryFn: ({ signal }) => api.muhurta.bestGoodTimes(params as BestGoodTimesParams, { signal }),
    enabled: params !== null && isAuthenticated && !loading,
    placeholderData: keepPreviousData,
  });
}

/** How many options the "Next best times" tile shows. */
export const BEST_COUNT = 3;
