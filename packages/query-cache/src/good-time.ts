import { type GoodTimesParams, queryKeys } from '@myvedicstar/api-client';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { scopedKey } from './keys';
import { useLocalDate } from './local-date';
import type { CalculationContext } from './panchang';
import { cachePolicies, defaultCacheSettings } from './policies';

export function goodTimeOptions(context: CalculationContext & { params: GoodTimesParams | null }) {
  const { api, params, userId, enabled = true, settings = defaultCacheSettings } = context;
  const valid = params !== null && Boolean(params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) &&
    (params.activity !== 'other' || Boolean(params.otherText?.trim()));
  return queryOptions({
    queryKey: scopedKey(params ? queryKeys.muhurta.goodTimes(params) : ['muhurta', 'good-times', 'idle'], userId, settings),
    queryFn: ({ signal }) => api.muhurta.goodTimes(params as GoodTimesParams, { signal }),
    enabled: enabled && userId !== null && valid,
    ...(settings.enabled ? cachePolicies.goodTime : { staleTime: 0, gcTime: 0 }),
  });
}

/** Stable intervals are cached; Now/Next remains computed locally by the existing view model. */
export function useGoodTime(context: CalculationContext & { params: GoodTimesParams | null }) {
  const today = useLocalDate(context.params?.location.timeZone);
  const params = context.params ? { ...context.params, date: context.params.date ?? today } : null;
  return useQuery(goodTimeOptions({ ...context, params }));
}
