import {
  type BestGoodTimesParams,
  type GoodTimesParams,
  type PanchangParams,
  queryKeys,
} from '@myvedicstar/api-client';
import { monthRange, panchangLocationParams, type YearMonth } from '@myvedicstar/domain-models';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

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
  const { api } = useServices();
  const { tradition } = useTradition();
  const language = useLanguage();
  return useQuery({
    queryKey: queryKeys.muhurta.activities(tradition, language),
    queryFn: ({ signal }) => api.muhurta.activities({ tradition, language }, { signal }),
    staleTime: 60 * 60_000,
  });
}

/**
 * The backend evaluation of a day for an activity (`/muhurta/good-times`), keyed by location, tradition, language,
 * date, activity and Other text; the previous result stays visible while a new selection loads.
 */
export function useGoodTimes(selection: GoodTimeSelection | null) {
  const { api } = useServices();
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const language = useLanguage();
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);

  const params: GoodTimesParams | null = useMemo(() => {
    if (!location || !settled) return null;
    if (settled.activity === 'other' && !settled.otherText?.trim()) return null;
    const base: PanchangParams = { location: panchangLocationParams(location), tradition, language };
    return { ...base, date: settled.date, activity: settled.activity, otherText: settled.otherText };
  }, [location, tradition, language, settled]);

  const query = useQuery({
    queryKey: params ? queryKeys.muhurta.goodTimes(params) : ['muhurta', 'good-times', 'idle'],
    queryFn: ({ signal }) => api.muhurta.goodTimes(params as GoodTimesParams, { signal }),
    enabled: params !== null,
    placeholderData: keepPreviousData,
  });
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
  const { api } = useServices();
  const base = useBaseParams();
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);
  const request = useMemo(() => {
    if (!base || !settled || !isComplete(settled.activity, settled.otherText)) return null;
    const { start, days } = monthRange(settled.yearMonth);
    return { start, days, params: { ...base, activity: settled.activity, otherText: settled.otherText } };
  }, [base, settled]);

  return useQuery({
    queryKey: request
      ? queryKeys.muhurta.daySummaries(request.start, request.days, request.params)
      : ['muhurta', 'day-summaries', 'idle'],
    queryFn: ({ signal }) => {
      const { start, days, params } = request as NonNullable<typeof request>;
      return api.muhurta.daySummaries(start, days, params, { signal });
    },
    enabled: request !== null,
    placeholderData: keepPreviousData,
  });
}

/** The next best Good Times for an activity (`/muhurta/good-times/best`), same as web. */
export function useBestGoodTimes(selection: { activity: string; otherText?: string | undefined } | null) {
  const { api } = useServices();
  const base = useBaseParams();
  const settled = useDebouncedValue(selection, SELECTION_SETTLE_MS);
  const params: BestGoodTimesParams | null = useMemo(() => {
    if (!base || !settled || !isComplete(settled.activity, settled.otherText)) return null;
    return { ...base, activity: settled.activity, otherText: settled.otherText, count: BEST_COUNT };
  }, [base, settled]);

  return useQuery({
    queryKey: params ? queryKeys.muhurta.bestGoodTimes(params) : ['muhurta', 'best', 'idle'],
    queryFn: ({ signal }) => api.muhurta.bestGoodTimes(params as BestGoodTimesParams, { signal }),
    enabled: params !== null,
    placeholderData: keepPreviousData,
  });
}
