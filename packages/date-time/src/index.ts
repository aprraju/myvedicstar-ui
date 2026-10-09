/**
 * Presentation-only date/time utilities. All Panchang values and instants come from the backend; this module only
 * formats them in the selected location's IANA time zone (never the device's zone, unless that is what was selected).
 *
 * Instants are ISO 8601 strings with offsets (e.g. `2026-09-29T07:23:20-05:00`) or epoch milliseconds.
 * Local dates are `yyyy-MM-dd` strings with no time zone.
 */

export type Instant = string | number | Date;
export type LocalDate = string;

export interface ZoneFormatOptions {
  timeZone: string;
  locale: string;
  /** Force 12- or 24-hour time; omit to follow the locale. */
  hour12?: boolean | undefined;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let cached = formatterCache.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(key, cached);
  }
  return cached;
}

export function toEpochMs(instant: Instant): number {
  if (typeof instant === 'number') return instant;
  if (instant instanceof Date) return instant.getTime();
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) throw new RangeError(`Invalid instant: ${instant}`);
  return ms;
}

/** `10:22 AM` (en-US) or `10:22` (en-GB) in the given zone. */
export function formatTime(instant: Instant, { timeZone, locale, hour12 }: ZoneFormatOptions): string {
  return formatter(locale, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    ...(hour12 === undefined ? {} : { hour12 }),
  }).format(toEpochMs(instant));
}

/** `3:10 PM – 4:39 PM`. The separator is locale-neutral; callers add "(next day)" via {@link dayOffset}. */
export function formatTimeRange(start: Instant, end: Instant, options: ZoneFormatOptions): string {
  return `${formatTime(start, options)} – ${formatTime(end, options)}`;
}

/** The local calendar date (`yyyy-MM-dd`) of an instant in a zone. */
export function localDateOf(instant: Instant, timeZone: string): LocalDate {
  const parts = zonedParts(toEpochMs(instant), timeZone);
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Today's local date at a location — which may differ from the device's date. */
export function todayIn(timeZone: string, now: Instant = Date.now()): LocalDate {
  return localDateOf(now, timeZone);
}

/** Whole-day difference between an instant's local date and a reference local date: -1, 0, +1, … */
export function dayOffset(instant: Instant, reference: LocalDate, timeZone: string): number {
  return daysBetween(reference, localDateOf(instant, timeZone));
}

/**
 * Formats a plain local date (no zone involved), e.g. `Monday, September 29`.
 * Uses UTC internally so the device's zone can never shift the date.
 */
export function formatLocalDate(
  date: LocalDate,
  locale: string,
  style: 'full' | 'long' | 'medium' | 'weekdayMonthDay' = 'weekdayMonthDay',
): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'weekdayMonthDay'
      ? { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }
      : { timeZone: 'UTC', dateStyle: style };
  return formatter(locale, options).format(localDateToUtcMs(date));
}

/** True when `now` is within [start, end). */
export function isWithin(now: Instant, start: Instant, end: Instant): boolean {
  const t = toEpochMs(now);
  return t >= toEpochMs(start) && t < toEpochMs(end);
}

/** The zone's UTC offset in minutes at an instant (e.g. -300 for CDT, 330 for IST). */
export function zoneOffsetMinutes(instant: Instant, timeZone: string): number {
  const ms = toEpochMs(instant);
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - (ms - (ms % 1000))) / 60_000);
}

/**
 * The instant a local date begins in a zone (normally 00:00; later if a DST gap swallows midnight).
 * Used to schedule a refresh when the location's day changes while the app stays open.
 */
export function startOfLocalDate(date: LocalDate, timeZone: string): number {
  const midnightAsUtc = localDateToUtcMs(date);
  let guess = midnightAsUtc - zoneOffsetMinutes(midnightAsUtc, timeZone) * 60_000;
  // Re-evaluate the offset at the guess: it differs when a DST transition lies between.
  guess = midnightAsUtc - zoneOffsetMinutes(guess, timeZone) * 60_000;
  // If a DST gap skipped midnight, the guess lands on the previous date; step forward to the first instant of `date`.
  if (localDateOf(guess, timeZone) < date) {
    while (localDateOf(guess, timeZone) < date) guess += 15 * 60_000;
  }
  return guess;
}

/** Milliseconds until the next local midnight at a location (for refetching "today" overnight). */
export function msUntilNextLocalDay(timeZone: string, now: Instant = Date.now()): number {
  const nowMs = toEpochMs(now);
  const tomorrow = addDays(localDateOf(nowMs, timeZone), 1);
  return startOfLocalDate(tomorrow, timeZone) - nowMs;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(localDateToUtcMs(date) + days * 86_400_000);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((localDateToUtcMs(to) - localDateToUtcMs(from)) / 86_400_000);
}

/** The device's IANA zone — only for defaults, never for displaying another location's times. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function localDateToUtcMs(date: LocalDate): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`Invalid local date: ${date}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(ms: number, timeZone: string): ZonedParts {
  const parts = formatter('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(ms);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/**
 * `3:10 PM – 4:39 PM`, marking each end that falls after `referenceDate` (the Panchang day) with `nextDayLabel`,
 * e.g. `11:08 PM – 12:57 AM (next day)`.
 */
export function formatRangeForDay(
  start: Instant,
  end: Instant,
  options: ZoneFormatOptions,
  referenceDate: LocalDate,
  nextDayLabel: string,
): string {
  const part = (instant: Instant) => {
    const text = formatTime(instant, options);
    return dayOffset(instant, referenceDate, options.timeZone) > 0 ? `${text} ${nextDayLabel}` : text;
  };
  return `${part(start)} – ${part(end)}`;
}
