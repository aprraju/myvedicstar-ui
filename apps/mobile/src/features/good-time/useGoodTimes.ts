import {
  type BestGoodTimesParams,
  type GoodTimesParams,
  type PanchangParams,
  queryKeys,
} from '@myvedicstar/api-client';
import { monthRange, panchangLocationParams, type YearMonth } from '@myvedicstar/domain-models';
import { scopedKey, useGoodTime, useLocalDate } from '@myvedicstar/query-cache';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../shared/auth';
import { useTranslation } from '../../shared/i18n';
import { useServices } from '../../shared/services';
import { useLocationState } from '../location/LocationProvider';
import { useTradition } from '../tradition/TraditionProvider';

/** Pause after the last change before requesting, so rapid repeated taps send one request. */
export const SELECTION_SETTLE_MS = 200;

export interface GoodTimeSelection {
  date?: string | undefined;
  activity: string;
  otherText?: string | undefined;
  nakshatra?: string | undefined;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function useLanguage() {
  const { locale } = useTranslation();
  return locale.split('-')[0];
}

/** The activity cards (`/muhurta/activities`), same as web. */
export function useMuhurtaActivities() {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const { tradition } = useTradition();
  const language = useLanguage();
  return useQuery({
    queryKey: scopedKey(queryKeys.muhurta.activities(tradition, language), user?.id ?? null, config.cache),
    queryFn: ({ signal }) => api.muhurta.activities({ tradition, language }, { signal }),
    enabled: isAuthenticated && !loading,
  });
}

/**
 * The backend evaluation of a day for an activity (`/muhurta/good-times`), keyed by location, tradition, language,
 * date, activity and Other text; the previous result stays visible while a new selection loads.
 */
export function useGoodTimes(selection: GoodTimeSelection | null) {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const language = useLanguage();
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);

  const params: GoodTimesParams | null = useMemo(() => {
    if (!location || !selection) return null;
    if (selection.activity === 'other' && !selection.otherText?.trim()) return null;
    const base: PanchangParams = { location: panchangLocationParams(location), tradition, language };
    return { ...base, date: selection.date, activity: selection.activity, otherText: selection.otherText, nakshatra: selection.nakshatra };
  }, [location, tradition, language, selection]);

  const query = useGoodTime({ api, params, userId: user?.id ?? null, settings: config.cache,
    enabled: isAuthenticated && !loading && JSON.stringify(selection) === JSON.stringify(settled) });
  return { query, params };
}

/** How many options the "Next best times" tile shows. */
export const BEST_COUNT = 3;

/** Location, tradition and language for the multi-day queries; null until a location is chosen. */
function useBaseParams(): PanchangParams | null {
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const language = useLanguage();
  return useMemo(
    () => (location ? { location: panchangLocationParams(location), tradition, language } : null),
    [location, tradition, language],
  );
}

/** Other needs a description before anything can be evaluated. */
const isComplete = (activity: string, otherText: string | undefined) =>
  activity !== 'other' || Boolean(otherText?.trim());

/** The backend's status of every day of a month for an activity (`/muhurta/day-summaries`), same as web. */
export function useGoodTimeMonth(
  selection: { yearMonth: YearMonth; activity: string; otherText?: string | undefined } | null,
) {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const base = useBaseParams();
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);
  const request = useMemo(() => {
    if (!base || !selection || !isComplete(selection.activity, selection.otherText)) return null;
    const { start, days } = monthRange(selection.yearMonth);
    return { start, days, params: { ...base, activity: selection.activity, otherText: selection.otherText } };
  }, [base, selection]);

  return useQuery({
    queryKey: scopedKey(request
      ? queryKeys.muhurta.daySummaries(request.start, request.days, request.params)
      : ['muhurta', 'day-summaries', 'idle'], user?.id ?? null, config.cache),
    queryFn: ({ signal }) => {
      const { start, days, params } = request as NonNullable<typeof request>;
      return api.muhurta.daySummaries(start, days, params, { signal });
    },
    enabled: request !== null && isAuthenticated && !loading && JSON.stringify(selection) === JSON.stringify(settled),
  });
}

/** The next best Good Times for an activity (`/muhurta/good-times/best`), same as web. */
export function useBestGoodTimes(selection: { activity: string; otherText?: string | undefined } | null) {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const base = useBaseParams();
  const today = useLocalDate(base?.location.timeZone);
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);
  const params: BestGoodTimesParams | null = useMemo(() => {
    if (!base || !selection || !isComplete(selection.activity, selection.otherText)) return null;
    return { ...base, activity: selection.activity, otherText: selection.otherText, count: BEST_COUNT };
  }, [base, selection]);

  return useQuery({
    queryKey: scopedKey(params ? [...queryKeys.muhurta.bestGoodTimes(params), today] : ['muhurta', 'best', 'idle'], user?.id ?? null, config.cache),
    queryFn: ({ signal }) => api.muhurta.bestGoodTimes(params as BestGoodTimesParams, { signal }),
    enabled: params !== null && isAuthenticated && !loading && JSON.stringify(selection) === JSON.stringify(settled),
  });
}
