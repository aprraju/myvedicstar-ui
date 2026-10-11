import { type PanchangParams, queryKeys } from '@myvedicstar/api-client';
import { panchangLocationParams } from '@myvedicstar/domain-models';
import { scopedKey, useLocalDate } from '@myvedicstar/query-cache';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '../../shared/auth';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useServices } from '../../shared/services/ServicesContext';
import { useLocationState } from '../location';
import { useTradition } from '../tradition';

/**
 * Festivals and observances from the selected location's today for `days` days (`GET /festivals/upcoming`), with the
 * tradition's regional names in the UI language. Location, tradition, language and range are all in the query key.
 */
export function useUpcomingFestivals(days: number) {
  const { api, config } = useServices();
  const { user, isAuthenticated, loading } = useAuth();
  const { location } = useLocationState();
  const { tradition } = useTradition();
  const { language } = useTranslation();
  const today = useLocalDate(location?.timeZone);

  const params: PanchangParams | null = useMemo(
    () => (location ? { location: panchangLocationParams(location), tradition, language } : null),
    [location, tradition, language],
  );

  const query = useQuery({
    queryKey: scopedKey(params
      ? [...queryKeys.festivals.upcoming(params, days), today]
      : ['festivals', 'upcoming', days, 'no-location'], user?.id ?? null, config.cache),
    queryFn: ({ signal }) => api.festivals.upcoming({ ...(params as PanchangParams), days }, { signal }),
    enabled: params !== null && isAuthenticated && !loading,
  });
  return { query, location };
}
