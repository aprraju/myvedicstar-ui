import { type PanchangParams } from '@myvedicstar/api-client';
import { buildDaySummary, panchangLocationParams, windowStatus } from '@myvedicstar/domain-models';
import { useToday } from '@myvedicstar/query-cache';
import { useMemo } from 'react';

import { useAuth } from '../../shared/auth';
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
  const { api, config } = useServices();
  const { user, loading } = useAuth();
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const { language } = useTranslation();

  const params: PanchangParams | null = useMemo(
    () => (location ? { location: panchangLocationParams(location), tradition, language } : null),
    [location, tradition, language],
  );

  const query = useToday({
    api,
    params,
    userId: user?.id ?? null,
    enabled: !loading,
    settings: config.cache,
  });

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
      noGoodTimeMessage:
        goodTime?.noGoodTimeReason && !/^[A-Z][A-Z0-9_]*$/.test(goodTime.noGoodTimeReason)
          ? goodTime.noGoodTimeReason
          : undefined,
    };
  }, [query.data, now, goodTimes.data, todayOnly]);
  return { query, goodTimes, location, summary, glossary: query.data?.glossary };
}
