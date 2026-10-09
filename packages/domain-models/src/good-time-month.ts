import type { BestGoodTimesResponse, DaySummariesResponse, MuhurtaDaySummary } from '@myvedicstar/contracts';
import type { LocalDate } from '@myvedicstar/date-time';

import { daysInMonth, toLocalDate, weekdayOf, type YearMonth } from './calendar';
import { type ExplainedSegment, explainSegment, type StatusTone, toneForStatus } from './good-time';

/**
 * Find a Good Time beyond one day: the month view of an activity and the "Next best times" tile. Every status and
 * Good Time comes from the backend (`/muhurta/day-summaries`, `/muhurta/good-times/best`); the UI only lays them out.
 */

export interface GoodTimeMonthDay {
  date: LocalDate;
  dayOfMonth: number;
  /** The backend's summary for the date; undefined while loading or when the response did not include it. */
  summary: MuhurtaDaySummary | undefined;
  tone: StatusTone | undefined;
  isToday: boolean;
  /** Before the location's today: shown, but no longer plannable. */
  isPast: boolean;
}

export interface GoodTimeMonth {
  year: number;
  month: number;
  /** Weeks Sunday → Saturday; `null` pads the days before the 1st and after the last day. */
  weeks: (GoodTimeMonthDay | null)[][];
  days: GoodTimeMonthDay[];
  /** Days with at least one Good Time, in date order. */
  daysWithGoodTimes: GoodTimeMonthDay[];
}

/** The `start` and `days` of the day-summaries request for a month. */
export function monthRange({ year, month }: YearMonth): { start: LocalDate; days: number } {
  return { start: toLocalDate(year, month, 1), days: daysInMonth(year, month) };
}

/** Lays out a month of day summaries for one activity; dates missing from the response stay without a status. */
export function buildGoodTimeMonth(
  response: DaySummariesResponse | undefined,
  { year, month }: YearMonth,
): GoodTimeMonth {
  const byDate = new Map((response?.days ?? []).map((day) => [day.date, day]));
  const today = response?.localToday;

  const days: GoodTimeMonthDay[] = [];
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const date = toLocalDate(year, month, d);
    const summary = byDate.get(date);
    days.push({
      date,
      dayOfMonth: d,
      summary,
      tone: summary ? toneForStatus(summary.status.status) : undefined,
      isToday: date === today,
      isPast: today !== undefined && date < today,
    });
  }

  const cells: (GoodTimeMonthDay | null)[] = [...Array<null>(weekdayOf(year, month, 1)).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (GoodTimeMonthDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return {
    year,
    month,
    weeks,
    days,
    daysWithGoodTimes: days.filter(
      (day) => (day.summary?.goodTimeCount ?? 0) > 0 && day.summary?.bestGoodTime,
    ),
  };
}

export interface BestGoodTimeItem extends ExplainedSegment {
  rank: number;
  date: LocalDate;
  dateDisplay: string;
}

/** The backend's next best Good Times in its order. Anything not flagged `isGoodTime` is dropped, never shown. */
export function buildBestGoodTimes(response: BestGoodTimesResponse | undefined): BestGoodTimeItem[] {
  return (response?.options ?? [])
    .filter((option) => option.segment.isGoodTime)
    .map((option) => ({
      ...explainSegment(option.segment),
      rank: option.rank,
      date: option.date,
      dateDisplay: option.dateDisplay,
    }));
}
