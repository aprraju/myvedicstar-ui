import { type PanchangParams } from '@myvedicstar/api-client';
import { buildDaySummary, panchangLocationParams, windowStatus } from '@myvedicstar/domain-models';
import { useToday } from '@myvedicstar/query-cache';
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
  const { api, config } = useServices();
  const { user, loading } = useAuth();
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const { locale } = useTranslation();
  const language = locale.split('-')[0];

  const params: PanchangParams | null = useMemo(
    () => (location ? { location: panchangLocationParams(location), tradition, language } : null),
    [location, tradition, language],
  );

  const query = useToday({
    api,
    params,
    userId: user?.id ?? null,
    enabled: !loading && !!user,
    settings: config.cache,
  });

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
