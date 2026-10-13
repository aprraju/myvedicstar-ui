import { type ApiClient, ApiError, type PanchangParams, queryKeys } from '@myvedicstar/api-client';
import type { PanchangResponse } from '@myvedicstar/contracts';
import { addDays, startOfLocalDate } from '@myvedicstar/date-time';
import { type QueryClient, queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { scopedKey } from './keys';
import { useLocalDate } from './local-date';
import { cachePolicies, type CacheSettings, defaultCacheSettings } from './policies';
import { validCalculationParams, validLocalDate } from './validation';

export interface CalculationContext {
  api: ApiClient;
  params: PanchangParams | null;
  userId: string | null;
  settings?: CacheSettings;
  enabled?: boolean;
}

/** Each range contributes complete, authoritative single-day responses with the original fetch timestamp. */
export function seedPanchangDays(
  client: QueryClient,
  response: PanchangResponse,
  params: PanchangParams,
  userId: string | null,
  settings: CacheSettings = defaultCacheSettings,
  updatedAt = Date.now(),
): void {
  if (!settings.enabled) return;
  for (const day of response.days) {
    const key = scopedKey(queryKeys.panchang.date(day.date, params), userId, settings);
    if ((client.getQueryState(key)?.dataUpdatedAt ?? 0) >= updatedAt) continue;
    client.setQueryData(key, { ...response, days: [day] }, { updatedAt });
  }
}

export function panchangDateOptions(context: CalculationContext, date: string) {
  const { api, params, userId, enabled = true, settings = defaultCacheSettings } = context;
  return queryOptions({
    queryKey: scopedKey(
      params ? queryKeys.panchang.date(date, params) : ['panchang', 'date', 'idle'],
      userId,
      settings,
    ),
    queryFn: ({ signal }) => api.panchang.date(date, params as PanchangParams, { signal }),
    enabled: enabled && validCalculationParams(params) && userId !== null && validLocalDate(date),
    ...(settings.enabled ? cachePolicies.panchang : { staleTime: 0, gcTime: 0 }),
  });
}

/** Tomorrow and arbitrary dates share one day key, including days previously fetched in a calendar/range. */
export function usePanchangDate(context: CalculationContext, date: string) {
  return useQuery(panchangDateOptions(context, date));
}

export function useTomorrow(context: CalculationContext) {
  const today = useLocalDate(context.params?.location.timeZone);
  return usePanchangDate(context, today ? addDays(today, 1) : '');
}

export function usePanchangRange(context: CalculationContext, start: string, days: number) {
  const client = useQueryClient();
  const { api, params, userId, enabled = true, settings = defaultCacheSettings } = context;
  const cached =
    settings.enabled && params && validLocalDate(start) && Number.isInteger(days) && days >= 1 && days <= 366
      ? cachedPanchangRange(client, params, userId, settings, start, days)
      : undefined;
  return useQuery({
    queryKey: scopedKey(
      params ? queryKeys.panchang.range(start, days, params) : ['panchang', 'range', 'idle'],
      userId,
      settings,
    ),
    queryFn: async ({ signal }) => {
      const data = await api.panchang.range(start, days, params as PanchangParams, { signal });
      if (!signal.aborted) seedPanchangDays(client, data, params as PanchangParams, userId, settings);
      return data;
    },
    enabled:
      enabled &&
      validCalculationParams(params) &&
      userId !== null &&
      validLocalDate(start) &&
      Number.isInteger(days) &&
      days >= 1 &&
      days <= 366,
    initialData: () => cached?.data,
    initialDataUpdatedAt: () => cached?.updatedAt,
    ...(settings.enabled ? cachePolicies.panchang : { staleTime: 0, gcTime: 0 }),
  });
}

/** Reassemble an overlapping range only when every requested day is already available in the same context. */
export function cachedPanchangRange(
  client: QueryClient,
  params: PanchangParams,
  userId: string | null,
  settings: CacheSettings,
  start: string,
  days: number,
): { data: PanchangResponse; updatedAt: number } | undefined {
  const states = Array.from({ length: days }, (_, index) =>
    client.getQueryState<PanchangResponse>(
      scopedKey(queryKeys.panchang.date(addDays(start, index), params), userId, settings),
    ),
  );
  const first = states[0]?.data;
  if (!first || states.some((state) => !state?.data || state.isInvalidated)) return undefined;
  return {
    data: { ...first, days: states.flatMap((state) => state?.data?.days ?? []) },
    updatedAt: Math.min(...states.map((state) => state?.dataUpdatedAt ?? 0)),
  };
}

export function useNextTenDays(context: CalculationContext) {
  const today = useLocalDate(context.params?.location.timeZone);
  return usePanchangRange(context, today ?? '', 10);
}

export function panchangMonthOptions(
  context: CalculationContext,
  client: QueryClient,
  year: number,
  month: number,
) {
  const { api, params, userId, enabled = true, settings = defaultCacheSettings } = context;
  return queryOptions({
    queryKey: scopedKey(
      params ? queryKeys.panchang.month(year, month, params) : ['panchang', 'month', year, month, 'idle'],
      userId,
      settings,
    ),
    queryFn: async ({ signal }) => {
      const data = await api.panchang.month(year, month, params as PanchangParams, { signal });
      if (!signal.aborted) seedPanchangDays(client, data, params as PanchangParams, userId, settings);
      return data;
    },
    enabled:
      enabled &&
      validCalculationParams(params) &&
      userId !== null &&
      Number.isInteger(year) &&
      year >= 1 &&
      year <= 9999 &&
      Number.isInteger(month) &&
      month >= 1 &&
      month <= 12,
    ...(settings.enabled ? cachePolicies.calendar : { staleTime: 0, gcTime: 0 }),
  });
}

export function useToday(context: CalculationContext) {
  const client = useQueryClient();
  const { api, params, userId, enabled = true, settings = defaultCacheSettings } = context;
  const timeZone = params?.location.timeZone;
  const date = useLocalDate(timeZone);
  const key = scopedKey(
    params ? queryKeys.panchang.today(params, date) : ['panchang', 'today', 'idle'],
    userId,
    settings,
  );
  const dayKey =
    params && date ? scopedKey(queryKeys.panchang.date(date, params), userId, settings) : undefined;
  const cachedDay = settings.enabled && dayKey ? client.getQueryState<PanchangResponse>(dayKey) : undefined;
  const query = useQuery<PanchangResponse>({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const data = await api.panchang.today(params as PanchangParams, { signal });
      // A response crossing midnight must never populate the new date's cache or be shown as Today.
      if (
        data.localToday !== date ||
        data.days.length !== 1 ||
        data.days[0]?.date !== date ||
        data.location.timeZone !== timeZone
      ) {
        throw new ApiError({ kind: 'validation' });
      }
      if (!signal.aborted) seedPanchangDays(client, data, params as PanchangParams, userId, settings);
      return data;
    },
    enabled: enabled && userId !== null && validCalculationParams(params) && date !== undefined,
    initialData: () => (cachedDay?.data && cachedDay.data.localToday === date ? cachedDay.data : undefined),
    initialDataUpdatedAt: () => cachedDay?.dataUpdatedAt,
    gcTime: settings.enabled ? cachePolicies.today.gcTime : 0,
    staleTime:
      settings.enabled && date && timeZone
        ? (query) => Math.max(0, startOfLocalDate(addDays(date, 1), timeZone) - query.state.dataUpdatedAt)
        : 0,
  });
  useEffect(() => {
    if (
      !settings.enabled ||
      !settings.prefetchTomorrow ||
      !query.isSuccess ||
      !date ||
      !params ||
      !userId ||
      !enabled
    )
      return;
    void client.prefetchQuery(panchangDateOptions(context, addDays(date, 1)));
  }, [
    client,
    context,
    date,
    enabled,
    params,
    query.isSuccess,
    settings.enabled,
    settings.prefetchTomorrow,
    userId,
  ]);
  return query;
}
