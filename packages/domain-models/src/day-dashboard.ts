import type {
  DailyPanchang,
  GuidanceFactor,
  PanchangResponse,
  PeriodOverlapInfo,
  TimePeriod,
} from '@myvedicstar/contracts';
import { isWithin, toEpochMs } from '@myvedicstar/date-time';

import { buildDaySummaryForDay, type DaySummary, elementAt, type ElementNow } from './day-summary';

/** The part of a favorable period inside an unfavorable one, as resolved by the backend (`overlaps`). */
export type PeriodOverlap = PeriodOverlapInfo;

/**
 * View model for the authenticated Today dashboard. Like the day summary, everything comes from the backend response;
 * the UI only adds the current instant (what is in force now, what is past) and positions on a 0–1 timeline.
 */

/**
 * `warning`: a favorable period with an unfavorable overlap (resolved conflict) — never shown as an unqualified good
 * time anywhere in the app.
 */
export type PeriodTone = 'favorable' | 'warning' | 'neutral' | 'caution';
export type PeriodState = 'past' | 'now' | 'upcoming';

export interface PeriodItem {
  period: TimePeriod;
  tone: PeriodTone;
  state: PeriodState;
  /** For auspicious periods: the backend-resolved overlaps with unfavorable periods (then `tone` is `warning`). */
  overlaps: PeriodOverlap[];
}

export interface TimelineEntry extends PeriodItem {
  /** Position of the start / end on the timeline, 0 (sunrise) to 1 (next sunrise), clamped. */
  from: number;
  to: number;
}

export interface DayTimeline {
  start: string;
  end: string;
  sunset: string;
  /** Sunset's position on the timeline (0–1). */
  sunsetAt: number;
  /** The current instant's position, or undefined when it is outside this day (another date, before sunrise…). */
  nowAt: number | undefined;
  entries: TimelineEntry[];
}

export type LimbKey = 'tithi' | 'nakshatra' | 'yoga' | 'karana';

export interface DayDashboard {
  summary: DaySummary;
  weekdayName: string;
  sunrise: string;
  sunset: string;
  nextSunrise: string;
  limbs: Record<LimbKey, ElementNow | undefined>;
  /** Auspicious periods (e.g. Amrit Kalam, Abhijit), in time order. */
  auspicious: PeriodItem[];
  /** Periods traditionally avoided or approached with caution (Rahu Kalam, Yamagandam, …), in time order. */
  avoid: PeriodItem[];
  timeline: DayTimeline;
  /** Why the day has its rating: one entry per Panchanga limb, from the backend's guidance. */
  ratingName: string;
  factors: GuidanceFactor[];
}

const TONE_BY_CLASSIFICATION: Record<string, PeriodTone> = {
  HighlyFavorable: 'favorable',
  Favorable: 'favorable',
  Neutral: 'neutral',
  Caution: 'caution',
  Avoid: 'caution',
};

export function toneForClassification(classification: string): PeriodTone {
  return TONE_BY_CLASSIFICATION[classification] ?? 'neutral';
}

/** Builds the dashboard for the first day in the response. */
export function buildDayDashboard(
  response: PanchangResponse,
  now: number = Date.now(),
): DayDashboard | undefined {
  const day = response.days[0];
  if (!day) return undefined;
  return buildDayDashboardForDay(day, response.location.timeZone, now);
}

export function buildDayDashboardForDay(day: DailyPanchang, timeZone: string, now: number): DayDashboard {
  const summary = buildDaySummaryForDay(day, timeZone, now);
  // Another date: show its limbs at sunrise and treat every period as upcoming.
  const reference = summary.isToday ? now : toEpochMs(day.sunrise);
  const byStart = (a: TimePeriod, b: TimePeriod) => toEpochMs(a.start) - toEpochMs(b.start);
  const inauspicious = [...day.inauspiciousPeriods].sort(byStart);
  const item = (period: TimePeriod, overlaps: PeriodOverlap[] = []): PeriodItem => ({
    period,
    tone: overlaps.length > 0 ? 'warning' : toneForClassification(period.classification),
    state: summary.isToday ? periodState(period, now) : 'upcoming',
    overlaps,
  });

  const auspicious = [...day.auspiciousPeriods]
    .sort(byStart)
    .map((period) => item(period, period.overlaps ?? []));
  const avoid = inauspicious.map((period) => item(period));

  return {
    summary,
    weekdayName: day.weekdayName,
    sunrise: day.sunrise,
    sunset: day.sunset,
    nextSunrise: day.nextSunrise,
    limbs: {
      tithi: elementAt(day.tithis, reference),
      nakshatra: elementAt(day.nakshatras, reference),
      yoga: elementAt(day.yogas, reference),
      karana: elementAt(day.karanas, reference),
    },
    auspicious,
    avoid,
    timeline: buildTimeline(day, [...auspicious, ...avoid], summary.isToday ? now : undefined),
    ratingName: day.guidance.ratingName,
    factors: day.guidance.factors,
  };
}

export function periodState(period: Pick<TimePeriod, 'start' | 'end'>, now: number): PeriodState {
  if (isWithin(now, period.start, period.end)) return 'now';
  return toEpochMs(period.end) <= now ? 'past' : 'upcoming';
}

/** Sunrise → next sunrise, with each period placed proportionally. */
function buildTimeline(
  day: DailyPanchang,
  items: readonly PeriodItem[],
  now: number | undefined,
): DayTimeline {
  const start = toEpochMs(day.sunrise);
  const span = Math.max(toEpochMs(day.nextSunrise) - start, 1);
  const at = (instant: string | number) => {
    const ms = typeof instant === 'number' ? instant : toEpochMs(instant);
    return Math.min(Math.max((ms - start) / span, 0), 1);
  };
  const entries = items
    .map((entry) => ({ ...entry, from: at(entry.period.start), to: at(entry.period.end) }))
    .filter((entry) => entry.to > entry.from)
    .sort((a, b) => a.from - b.from);
  const nowAt = now !== undefined && now >= start && now <= start + span ? at(now) : undefined;
  return {
    start: day.sunrise,
    end: day.nextSunrise,
    sunset: day.sunset,
    sunsetAt: at(day.sunset),
    nowAt,
    entries,
  };
}
