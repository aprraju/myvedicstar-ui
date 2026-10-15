import { type PanchangParams } from '@myvedicstar/api-client';
import { panchangLocationParams } from '@myvedicstar/domain-models';
import { useToday } from '@myvedicstar/query-cache';
import { useMemo } from 'react';

import { useAuth } from '../../shared/auth';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import { useServices } from '../../shared/services/ServicesContext';
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
    enabled: !loading && !!user,
    settings: config.cache,
  });

  return { query, location };
}
