import { type PanchangParams, queryKeys } from '@myvedicstar/api-client';
import { buildCalendarMonth, panchangLocationParams, type YearMonth } from '@myvedicstar/domain-models';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '../../shared/auth';
import { useNow } from '../../shared/hooks/useNow';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useServices } from '../../shared/services/ServicesContext';
import { useLocationState } from '../location';
import { useTradition } from '../tradition';

/**
 * One month of Panchang for the selected location, tradition and language (`GET /panchang/month/{year}/{month}`), laid
 * out as a calendar. The query key includes all of them, so another month or context never shows stale data as current.
 */
export function useCalendarMonth(yearMonth: YearMonth) {
  const { api } = useServices();
  const { isAuthenticated, loading } = useAuth();
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const { language } = useTranslation();
  const now = useNow();

  const params: PanchangParams | null = useMemo(
    () => (location ? { location: panchangLocationParams(location), tradition, language } : null),
    [location, tradition, language],
  );
  const { year, month } = yearMonth;

  const query = useQuery({
    queryKey: params
      ? queryKeys.panchang.month(year, month, params)
      : ['panchang', 'month', year, month, 'no-location'],
    queryFn: ({ signal }) => api.panchang.month(year, month, params as PanchangParams, { signal }),
    enabled: params !== null && isAuthenticated && !loading,
  });

  const calendar = useMemo(
    () => buildCalendarMonth(query.data, { year, month }, now),
    [query.data, year, month, now],
  );
  return { query, location, calendar, glossary: query.data?.glossary };
}
