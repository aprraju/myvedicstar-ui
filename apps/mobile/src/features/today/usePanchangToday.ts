import { type PanchangParams, queryKeys } from '@myvedicstar/api-client';
import { msUntilNextLocalDay, todayIn } from '@myvedicstar/date-time';
import { buildDaySummary, panchangLocationParams } from '@myvedicstar/domain-models';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useTranslation } from '../../shared/i18n';
import { useServices } from '../../shared/services';
import { useGoodTimes } from '../good-time/useGoodTimes';
import { useLocationState } from '../location/LocationProvider';
import { useTradition } from '../tradition/TraditionProvider';

/** Today's Panchang for the selected location, tradition and language (all part of the query key). */
export function usePanchangToday() {
  const { api } = useServices();
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const { locale } = useTranslation();
  const language = locale.split('-')[0];

  const params: PanchangParams | null = useMemo(
    () => (location ? { location: panchangLocationParams(location), tradition, language } : null),
    [location, tradition, language],
  );

  const query = useQuery({
    queryKey: params ? queryKeys.panchang.today(params) : ['panchang', 'today', 'no-location'],
    queryFn: ({ signal }) => api.panchang.today(params as PanchangParams, { signal }),
    enabled: params !== null,
  });

  // Refetch when the location's day changes (app left open overnight, or resumed on a new day).
  const timeZone = location?.timeZone;
  const { refetch, data } = query;
  useEffect(() => {
    if (!timeZone || !data) return;
    const checkDay = () => {
      if (data.localToday !== todayIn(timeZone)) void refetch();
    };
    checkDay();
    const timer = setTimeout(() => void refetch(), msUntilNextLocalDay(timeZone) + 1_000);
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && checkDay());
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [timeZone, data, refetch]);

  return { query, location };
}

/** Current instant, refreshed each minute and when the app returns to the foreground. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    const subscription = AppState.addEventListener(
      'change',
      (state) => state === 'active' && setNow(Date.now()),
    );
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return now;
}

/** The day summary; its Good Time comes from the backend's General evaluation of today, never from Panchang periods. */
export function useDaySummary() {
  const { query, location } = usePanchangToday();
  const { query: goodTimes } = useGoodTimes(location ? { activity: 'general' } : null);
  const now = useNow();
  const summary = useMemo(
    () => (query.data ? buildDaySummary(query.data, now, goodTimes.data) : undefined),
    [query.data, now, goodTimes.data],
  );
  return { query, location, summary, glossary: query.data?.glossary };
}
