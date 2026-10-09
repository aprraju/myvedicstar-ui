import { buildDayDashboard } from '@myvedicstar/domain-models';
import { useMemo } from 'react';

import { useNow } from '../../shared/hooks/useNow';
import { usePanchangToday } from '../today';

/** The Today dashboard view model for the selected location and tradition, recomputed every minute. */
export function useDayDashboard() {
  const { query, location } = usePanchangToday();
  const now = useNow();
  const dashboard = useMemo(
    () => (query.data ? buildDayDashboard(query.data, now) : undefined),
    [query.data, now],
  );
  return { query, location, dashboard, glossary: query.data?.glossary };
}
