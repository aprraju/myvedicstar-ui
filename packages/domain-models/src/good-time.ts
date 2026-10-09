import type {
  GoodTimeConflict,
  GoodTimeReason,
  GoodTimeSegment,
  GoodTimesResponse,
  MuhurtaActivity,
} from '@myvedicstar/contracts';
import { isWithin, toEpochMs } from '@myvedicstar/date-time';

/**
 * View models for Find a Good Time. The backend rules engine is authoritative: every status, Good Time, reason and
 * conflict comes from the response. The UI only selects by the backend's flags (`isGoodTime`, `status`) and compares
 * times with the clock (which segment is in progress). It never promotes a segment the backend did not mark
 * `isGoodTime` — not even when no Good Time exists.
 */

/**
 * Visual tone of a resolved status, the same everywhere in the app: Highly Favorable → strong green, Favorable → green,
 * Mixed and Caution → orange, Avoid → red. Always rendered with an icon and text, never color alone.
 */
export type StatusTone = 'highly-favorable' | 'favorable' | 'mixed' | 'caution' | 'avoid';

const TONE_BY_STATUS: Record<string, StatusTone> = {
  HighlyFavorable: 'highly-favorable',
  Favorable: 'favorable',
  Mixed: 'mixed',
  Caution: 'caution',
  Avoid: 'avoid',
};

/** Unknown statuses from a newer backend are shown as Mixed: never as favorable. */
export function toneForStatus(status: string): StatusTone {
  return TONE_BY_STATUS[status] ?? 'mixed';
}

/** Whether the tone is one of the two favorable tones (used for icons: check vs. warning). */
export function isFavorableTone(tone: StatusTone): boolean {
  return tone === 'highly-favorable' || tone === 'favorable';
}

/** The activity selected by default: an explicit request wins, then the backend's default, then `general`. */
export function defaultActivityKey(
  activities: readonly MuhurtaActivity[],
  defaultActivity: string | undefined,
  requested?: string | null,
): string {
  const known = (key: string | null | undefined) =>
    key ? activities.find((activity) => activity.key === key.toLowerCase())?.key : undefined;
  return known(requested) ?? known(defaultActivity) ?? 'general';
}

export interface ExplainedSegment {
  segment: GoodTimeSegment;
  tone: StatusTone;
  /** "✓" reasons: supportive factors and favorable periods (no "No … conflict" lines). */
  supports: GoodTimeReason[];
  /** "✓ No Rahu Kalam conflict" lines (only on Good Times). */
  clearOf: GoodTimeReason[];
  /** "⚠" reasons: less supportive or excluded factors, excluded months. */
  cautions: GoodTimeReason[];
  /** "⚠ Overlaps Rahu Kalam" lines with times. */
  conflicts: GoodTimeConflict[];
}

export interface GoodTimeView {
  /** Good Times in the backend's ranking order (best first). Empty when none qualifies. */
  goodTimes: ExplainedSegment[];
  /**
   * Favorable periods the backend did not recommend because of a conflict (e.g. Amrit Kalam overlapping Rahu Kalam),
   * in time order: shown so the user understands why.
   */
  notRecommended: ExplainedSegment[];
  /** Every segment of the evaluation window, in time order (timeline). */
  segments: ExplainedSegment[];
  dayTone: StatusTone;
  /** Present when there is no Good Time: the backend's reason code and message. */
  noGoodTime: { reason: string; message: string } | undefined;
  /** The segment in progress when the date is the location's today (by clock), else undefined. */
  now: ExplainedSegment | undefined;
  /** The next Good Time starting after now, when the date is today. */
  next: ExplainedSegment | undefined;
}

export function explainSegment(segment: GoodTimeSegment): ExplainedSegment {
  const positive = segment.reasons.filter((reason) => reason.type === 'positive');
  return {
    segment,
    tone: toneForStatus(segment.status.status),
    supports: positive.filter((reason) => !isNoConflictReason(reason)),
    clearOf: positive.filter(isNoConflictReason),
    cautions: segment.reasons.filter((reason) => reason.type === 'negative'),
    conflicts: segment.conflicts,
  };
}

export function buildGoodTimeView(response: GoodTimesResponse, now: number = Date.now()): GoodTimeView {
  const segments = response.segments.map(explainSegment);
  const byId = new Map(segments.map((item) => [item.segment.id, item]));
  const goodTimes = response.goodTimes
    .map((id) => byId.get(id))
    .filter((item): item is ExplainedSegment => item !== undefined && item.segment.isGoodTime);

  const notRecommended = segments.filter(
    (item) => !item.segment.isGoodTime && item.conflicts.some((conflict) => conflict.withFavorable),
  );

  const isToday = response.date === response.localToday;
  const current = isToday
    ? segments.find((item) => isWithin(now, item.segment.start, item.segment.end))
    : undefined;
  const next = isToday
    ? segments
        .filter((item) => item.segment.isGoodTime && toEpochMs(item.segment.start) > now)
        .sort((a, b) => toEpochMs(a.segment.start) - toEpochMs(b.segment.start))[0]
    : undefined;

  return {
    goodTimes,
    notRecommended,
    segments,
    dayTone: toneForStatus(response.dayStatus.status),
    noGoodTime:
      goodTimes.length === 0
        ? {
            reason: response.noGoodTimeReason ?? 'NO_QUALIFYING_PERIOD',
            message: response.noGoodTimeMessage ?? '',
          }
        : undefined,
    now: current,
    next,
  };
}

function isNoConflictReason(reason: GoodTimeReason): boolean {
  return reason.code.startsWith('NO_') && reason.code.endsWith('_CONFLICT');
}
