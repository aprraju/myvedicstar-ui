import type {
  DailyPanchang,
  GoodTimeSegment,
  GoodTimesResponse,
  GoodTimeWindow,
  MuhurtaStatusInfo,
  PanchangElement,
  PanchangResponse,
  TimePeriod,
} from '@myvedicstar/contracts';
import { isWithin, type LocalDate, todayIn, toEpochMs } from '@myvedicstar/date-time';

import { type StatusTone, toneForStatus } from './good-time';

/**
 * View model for the "How is today?" card. Everything is derived from the backend response; the only inputs the UI
 * adds are the current instant and simple comparisons (is `now` inside a window, which window comes next).
 *
 * The overall rating and label come from Panchang guidance. Recommended windows come from the General good-times
 * evaluation. The UI never derives a Good Time from Panchang periods.
 */

/** Visual tone of the day: the app-wide status tones. Always rendered with an icon and text, never color alone. */
export type DayTone = StatusTone;

/** `unavailable` while the Good Time evaluation has not loaded (or failed): show nothing rather than a guess. */
export type GoodTimeStatus = WindowStatus<GoodTimeSegment | GoodTimeWindow> | { status: 'unavailable' };

export type Paksha = 'shukla' | 'krishna';

export interface ElementNow {
  current: PanchangElement;
  next: PanchangElement | undefined;
}

export type WindowStatus<T> =
  { status: 'now'; window: T } | { status: 'next'; window: T } | { status: 'none' };

export interface DaySummary {
  date: LocalDate;
  timeZone: string;
  /** True when the Panchang date is the location's current local date. */
  isToday: boolean;
  /** Panchang guidance rating key used for the visual tone. */
  rating: string;
  tone: DayTone;
  /** The General day status from the backend (`goodTime` on the Panchang day), when present. */
  dayStatus: MuhurtaStatusInfo | undefined;
  /** Localized Panchang guidance ratingName from the backend. */
  headline: string;
  /** First sentence of the backend's localized day-factor summary. */
  description: string;
  paksha: Paksha | undefined;
  tithi: ElementNow | undefined;
  nakshatra: ElementNow | undefined;
  /** Good Time in progress or next, among the segments the backend marked `isGoodTime` (never any other). */
  goodTime: GoodTimeStatus;
  /** The backend's message when the day has no Good Time at all. */
  noGoodTimeMessage: string | undefined;
  caution: WindowStatus<TimePeriod>;
}

/** Day-factor ratings use the same five-status vocabulary and tones as Find a Good Time. */
export function toneForRating(rating: string): DayTone {
  return toneForStatus(rating);
}

/**
 * Builds the summary for the first day in the response. `goodTimes` is the General `good-times` evaluation of the same
 * date; without it the Good Time is `unavailable` (never derived locally).
 */
export function buildDaySummary(
  response: PanchangResponse,
  now: number = Date.now(),
  goodTimes?: GoodTimesResponse,
): DaySummary | undefined {
  const day = response.days[0];
  if (!day) return undefined;
  return buildDaySummaryForDay(day, response.location.timeZone, now, goodTimes);
}

export function buildDaySummaryForDay(
  day: DailyPanchang,
  timeZone: string,
  now: number,
  goodTimes?: GoodTimesResponse,
): DaySummary {
  const guidance = day.guidance;
  const isToday = todayIn(timeZone, now) === day.date;
  // For another date, show that date's first windows instead of "now/next".
  const reference = isToday ? now : toEpochMs(day.sunrise);
  const dayStatus = day.goodTime?.status;
  const rating = guidance.rating;
  const evaluation = goodTimes?.date === day.date ? goodTimes : undefined;

  const tithi = elementAt(day.tithis, reference);
  return {
    date: day.date,
    timeZone,
    isToday,
    rating,
    tone: toneForStatus(rating),
    dayStatus,
    headline: guidance.ratingName,
    description: firstSentence(guidance.summary),
    paksha: pakshaOf(tithi?.current ?? day.tithis[0]),
    tithi,
    nakshatra: elementAt(day.nakshatras, reference),
    goodTime: evaluation
      ? windowStatus(
          evaluation.segments.filter((segment) => segment.isGoodTime),
          reference,
        )
      : { status: 'unavailable' },
    noGoodTimeMessage: evaluation?.noGoodTimeMessage ?? undefined,
    caution: windowStatus([...guidance.avoidWindows, ...guidance.cautionWindows], reference),
  };
}

/** The element in force at `at` (or the first one) and the one that follows it. */
export function elementAt(elements: readonly PanchangElement[], at: number): ElementNow | undefined {
  if (elements.length === 0) return undefined;
  const index = elements.findIndex((e) => isWithin(at, e.start, e.end));
  const i = index === -1 ? 0 : index;
  return { current: elements[i] as PanchangElement, next: elements[i + 1] };
}

/** Whether `at` is inside one of the windows, otherwise the next one to start. */
export function windowStatus<T extends { start: string; end: string }>(
  windows: readonly T[],
  at: number,
): WindowStatus<T> {
  const sorted = [...windows].sort((a, b) => toEpochMs(a.start) - toEpochMs(b.start));
  const current = sorted.find((w) => isWithin(at, w.start, w.end));
  if (current) return { status: 'now', window: current };
  const next = sorted.find((w) => toEpochMs(w.start) > at);
  return next ? { status: 'next', window: next } : { status: 'none' };
}

/** Tithi 1–15 are the waxing (Shukla) fortnight, 16–30 the waning (Krishna) — a definition, not a calculation. */
export function pakshaOf(tithi: PanchangElement | undefined): Paksha | undefined {
  if (!tithi) return undefined;
  if (tithi.number >= 1 && tithi.number <= 15) return 'shukla';
  if (tithi.number >= 16 && tithi.number <= 30) return 'krishna';
  return undefined;
}

export function stripLeadingIcon(text: string, icon: string): string {
  const trimmed = text.trim();
  return (icon && trimmed.startsWith(icon) ? trimmed.slice(icon.length) : trimmed).trim();
}

/** First sentence, ending at `.`, `!`, `?` or the Devanagari danda. Returns the whole text if none is found. */
export function firstSentence(text: string): string {
  const match = /^(.+?[.!?।])(?:\s|$)/u.exec(text.trim());
  return (match?.[1] ?? text).trim();
}
