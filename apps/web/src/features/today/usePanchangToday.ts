import { type PanchangParams, queryKeys } from '@myvedicstar/api-client';
import { msUntilNextLocalDay, todayIn } from '@myvedicstar/date-time';
import { buildDaySummary, panchangLocationParams, windowStatus } from '@myvedicstar/domain-models';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useNow } from '../../shared/hooks/useNow';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useServices } from '../../shared/services/ServicesContext';
import { useGoodTimes } from '../good-time/useGoodTimes';
import { useLocationState } from '../location';
import { useTradition } from '../tradition';

/**
 * Today's Panchang for the selected location and tradition. The query key includes location, tradition and language,
 * so changing any of them fetches the right data and never shows another context's data as current.
 */
export function usePanchangToday() {
  const { api } = useServices();
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const { language } = useTranslation();

  const params: PanchangParams | null = useMemo(
    () => (location ? { location: panchangLocationParams(location), tradition, language } : null),
    [location, tradition, language],
  );

  const query = useQuery({
    queryKey: params ? queryKeys.panchang.today(params) : ['panchang', 'today', 'no-location'],
    queryFn: ({ signal }) => api.panchang.today(params as PanchangParams, { signal }),
    enabled: params !== null,
  });

  // When the location's day changes while the page stays open, fetch the new day.
  const timeZone = location?.timeZone;
  const { refetch, data } = query;
  useEffect(() => {
    if (!timeZone || !data) return;
    if (data.localToday !== todayIn(timeZone)) {
      void refetch();
      return;
    }
    const timer = setTimeout(() => void refetch(), msUntilNextLocalDay(timeZone) + 1_000);
    return () => clearTimeout(timer);
  }, [timeZone, data, refetch]);

  return { query, location };
}

/**
 * Recompute the summary every minute. Public home uses today's embedded Good Time evaluation;
 * other views request the General good-times evaluation for its full set of windows.
 */
export function useDaySummary(todayOnly = false) {
  const { query, location } = usePanchangToday();
  const { query: goodTimes } = useGoodTimes(!todayOnly && location ? { activity: 'general' } : null);
  const now = useNow();
  const summary = useMemo(() => {
    if (!query.data) return undefined;
    const result = buildDaySummary(query.data, now, todayOnly ? undefined : goodTimes.data);
    if (!todayOnly || !result) return result;
    const day = query.data.days[0];
    if (!day) return result;
    const goodTime = day.goodTime;
    const reference = result.isToday ? now : Date.parse(day.sunrise);
    return {
      ...result,
      goodTime: goodTime
        ? windowStatus(goodTime.bestGoodTime ? [goodTime.bestGoodTime] : [], reference)
        : { status: 'unavailable' as const },
      noGoodTimeMessage: goodTime?.noGoodTimeReason ?? undefined,
    };
  }, [query.data, now, goodTimes.data, todayOnly]);
  return { query, goodTimes, location, summary, glossary: query.data?.glossary };
}
