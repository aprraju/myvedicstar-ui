import { type PanchangParams, queryKeys } from '@myvedicstar/api-client';
import { msUntilNextLocalDay, todayIn } from '@myvedicstar/date-time';
import { buildDaySummary, panchangLocationParams, windowStatus } from '@myvedicstar/domain-models';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../../shared/auth';
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

/** Visitors use Today's embedded evaluation; signed-in users can load the full General evaluation. */
export function useDaySummary() {
  const { query, location } = usePanchangToday();
  const { isAuthenticated } = useAuth();
  const { query: goodTimes } = useGoodTimes(isAuthenticated && location ? { activity: 'general' } : null);
  const now = useNow();
  const summary = useMemo(() => {
    if (!query.data) return undefined;
    const result = buildDaySummary(query.data, now, isAuthenticated ? goodTimes.data : undefined);
    if (isAuthenticated || !result) return result;
    const day = query.data.days[0];
    if (!day) return result;
    const evaluation = day.goodTime;
    const reference = result.isToday ? now : Date.parse(day.sunrise);
    return {
      ...result,
      goodTime: evaluation
        ? windowStatus(evaluation.bestGoodTime ? [evaluation.bestGoodTime] : [], reference)
        : { status: 'unavailable' as const },
      noGoodTimeMessage:
        evaluation?.noGoodTimeReason && !/^[A-Z][A-Z0-9_]*$/.test(evaluation.noGoodTimeReason)
          ? evaluation.noGoodTimeReason
          : undefined,
    };
  }, [query.data, now, goodTimes.data, isAuthenticated]);

  return { query, location, summary, glossary: query.data?.glossary };
}
