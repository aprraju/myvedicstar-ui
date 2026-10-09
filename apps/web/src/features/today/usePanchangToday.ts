import { type PanchangParams, queryKeys } from '@myvedicstar/api-client';
import { msUntilNextLocalDay, todayIn } from '@myvedicstar/date-time';
import { buildDaySummary, panchangLocationParams } from '@myvedicstar/domain-models';
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
 * The day summary view model, recomputed every minute. The Good Time comes from the backend's General evaluation of
 * today (`/muhurta/good-times`) — the same service as Find a Good Time — never from Panchang periods.
 */
export function useDaySummary() {
  const { query, location } = usePanchangToday();
  const { query: goodTimes } = useGoodTimes(location ? { activity: 'general' } : null);
  const now = useNow();
  const summary = useMemo(
    () => (query.data ? buildDaySummary(query.data, now, goodTimes.data) : undefined),
    [query.data, now, goodTimes.data],
  );
  return { query, goodTimes, location, summary, glossary: query.data?.glossary };
}
