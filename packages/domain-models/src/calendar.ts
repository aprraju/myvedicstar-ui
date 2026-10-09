import type { DailyPanchang, PanchangElement, PanchangResponse } from '@myvedicstar/contracts';
import { type LocalDate, todayIn, toEpochMs } from '@myvedicstar/date-time';

import { type DayTone, elementAt } from './day-summary';
import { toneForStatus } from './good-time';

/**
 * View model for the month calendar. Every value comes from the backend's month response; the UI only lays the days out
 * in weeks and labels well-known observances from the Tithi number the backend returns (a definition, not astronomy).
 * A tile's status is the backend's General day status (`goodTime`), the same as Home and Find a Good Time.
 */

/** Observances recognised from the Tithi in force at sunrise (udaya tithi): 11/26 Ekadashi, 15 Purnima, 30 Amavasya. */
export type Observance = 'ekadashi' | 'purnima' | 'amavasya';

export interface CalendarDay {
  date: LocalDate;
  dayOfMonth: number;
  /** The backend's data for the date; undefined when the response did not include it. */
  panchang: DailyPanchang | undefined;
  /** Tithi in force at sunrise. */
  tithi: PanchangElement | undefined;
  /** From the General day status (`goodTime.status`); the day-factor rating only for older responses without it. */
  tone: DayTone | undefined;
  ratingName: string | undefined;
  observance: Observance | undefined;
  isToday: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  /** Weeks Sunday → Saturday; `null` pads the days before the 1st and after the last day. */
  weeks: (CalendarDay | null)[][];
  days: CalendarDay[];
}

export interface YearMonth {
  year: number;
  month: number;
}

export function observanceOf(tithi: PanchangElement | undefined): Observance | undefined {
  switch (tithi?.number) {
    case 11:
    case 26:
      return 'ekadashi';
    case 15:
      return 'purnima';
    case 30:
      return 'amavasya';
    default:
      return undefined;
  }
}

/** Lays out the month `year`-`month` (1–12) from a month response; dates missing from the response stay empty. */
export function buildCalendarMonth(
  response: PanchangResponse | undefined,
  { year, month }: YearMonth,
  now: number = Date.now(),
): CalendarMonth {
  const byDate = new Map((response?.days ?? []).map((day) => [day.date, day]));
  const today = response ? todayIn(response.location.timeZone, now) : undefined;
  const count = daysInMonth(year, month);

  const days: CalendarDay[] = [];
  for (let d = 1; d <= count; d++) {
    const date = toLocalDate(year, month, d);
    const panchang = byDate.get(date);
    const tithi = panchang ? elementAt(panchang.tithis, toEpochMs(panchang.sunrise))?.current : undefined;
    days.push({
      date,
      dayOfMonth: d,
      panchang,
      tithi,
      tone: panchang
        ? toneForStatus(panchang.goodTime?.status.status ?? panchang.guidance.rating)
        : undefined,
      ratingName: panchang ? (panchang.goodTime?.status.name ?? panchang.guidance.ratingName) : undefined,
      observance: observanceOf(tithi),
      isToday: date === today,
    });
  }

  const cells: (CalendarDay | null)[] = [...Array<null>(weekdayOf(year, month, 1)).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { year, month, weeks, days };
}

/** `2026-10-15` → `{ year: 2026, month: 10 }`. */
export function yearMonthOf(date: LocalDate): YearMonth {
  const [year, month] = date.split('-').map(Number) as [number, number];
  return { year, month };
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** `?month=` value, e.g. `2026-10`; undefined when malformed or out of range. */
export function parseYearMonth(value: string | null | undefined): YearMonth | undefined {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 && year >= 1900 && year <= 2200 ? { year, month } : undefined;
}

export function formatYearMonth({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday, for a calendar date (no time zone involved). */
export function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function toLocalDate(year: number, month: number, day: number): LocalDate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
