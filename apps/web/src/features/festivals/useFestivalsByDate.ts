import type { Festival } from '@myvedicstar/contracts';
import type { LocalDate } from '@myvedicstar/date-time';
import { useMemo } from 'react';

import { useUpcomingFestivals } from './useUpcomingFestivals';

/** The backend accepts up to 90 days; one cached request serves the day card, calendar tiles and day panel. */
const FESTIVAL_WINDOW_DAYS = 90;

export interface FestivalsByDate {
  /** Festivals per local date, in the backend's order. */
  byDate: ReadonlyMap<LocalDate, readonly Festival[]>;
  /** Dates the data covers (`from`–`to`); outside it nothing is known (not "no festival"). */
  covers: (date: LocalDate) => boolean;
  festivalsOn: (date: LocalDate) => readonly Festival[];
}

const EMPTY: readonly Festival[] = [];

/** Upcoming festivals (today + 90 days) for the selected location and tradition, indexed by date. */
export function useFestivalsByDate(): FestivalsByDate {
  const { query } = useUpcomingFestivals(FESTIVAL_WINDOW_DAYS);
  const data = query.data;
  return useMemo(() => {
    const byDate = new Map<LocalDate, Festival[]>();
    for (const festival of data?.festivals ?? []) {
      const list = byDate.get(festival.date);
      if (list) list.push(festival);
      else byDate.set(festival.date, [festival]);
    }
    const from = data?.from;
    const to = data?.to;
    return {
      byDate,
      covers: (date) => from !== undefined && to !== undefined && date >= from && date <= to,
      festivalsOn: (date) => byDate.get(date) ?? EMPTY,
    };
  }, [data]);
}
