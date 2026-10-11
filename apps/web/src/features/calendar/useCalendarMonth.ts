import { type PanchangParams } from '@myvedicstar/api-client';
import { buildCalendarMonth, panchangLocationParams, type YearMonth } from '@myvedicstar/domain-models';
import { panchangMonthOptions } from '@myvedicstar/query-cache';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const client = useQueryClient();
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const { language } = useTranslation();
  const now = useNow();

  const params: PanchangParams | null = useMemo(
    () => (location ? { location: panchangLocationParams(location), tradition, language } : null),
    [location, tradition, language],
  );
  const { year, month } = yearMonth;

  const query = useQuery(
    panchangMonthOptions(
      { api, params, userId: user?.id ?? null, enabled: isAuthenticated && !loading, settings: config.cache },
      client,
      year,
      month,
    ),
  );

  const calendar = useMemo(
    () => buildCalendarMonth(query.data, { year, month }, now),
    [query.data, year, month, now],
  );
  return { query, location, calendar, glossary: query.data?.glossary };
}
