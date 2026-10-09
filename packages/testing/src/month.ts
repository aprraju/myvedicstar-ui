import type { DailyPanchang, PanchangResponse } from '@myvedicstar/contracts';

/**
 * Builds a month-endpoint response (`GET /panchang/month/{year}/{month}`) for tests from one captured day: every date
 * of the month gets a copy of the template day with instants shifted to that date, a cycling Tithi (so Ekadashi,
 * Purnima and Amavasya fall on known dates) and a cycling rating. Synthetic data for UI tests only — never astronomy.
 *
 * Tithi at sunrise by day of month: 1 → Shukla Ekadashi (11), 5 → Purnima (15), 16 → Krishna Ekadashi (26),
 * 20 → Amavasya (30). Day-factor rating by day of month: d % 3 = 0 Favorable, 1 Mixed, 2 Caution. General day
 * status (`goodTime`, when the template has one) cycles differently — 0 HighlyFavorable, 1 Mixed, 2 Avoid — so tests
 * can tell which one a view used.
 */
export function buildPanchangMonth(base: PanchangResponse, year: number, month: number): PanchangResponse {
  const template = base.days[0];
  if (!template) throw new Error('template response has no days');
  const offsetSuffix = /([+-]\d{2}:\d{2})$/.exec(template.sunrise)?.[1] ?? '+00:00';
  const offsetMs = parseOffset(offsetSuffix);
  const templateMidnight = Date.parse(`${template.date}T00:00:00Z`);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const days: DailyPanchang[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const shiftDays = (Date.UTC(year, month - 1, d) - templateMidnight) / DAY_MS;
    const shift = (instant: string) =>
      formatInstant(Date.parse(instant) + shiftDays * DAY_MS, offsetMs, offsetSuffix);
    const day = JSON.parse(JSON.stringify(template), (_key, value: unknown) =>
      typeof value === 'string' && ISO_INSTANT.test(value) ? shift(value) : value,
    ) as DailyPanchang;

    const date = `${year}-${pad(month)}-${pad(d)}`;
    const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, d)).getUTCDay()] ?? 'Sunday';
    const first = ((d + 9) % 30) + 1;
    const second = (first % 30) + 1;
    const rating = RATINGS[d % 3] ?? 'Mixed';
    const goodTimeStatus = GOOD_TIME_STATUSES[d % 3] ?? GOOD_TIME_STATUSES[1];

    days.push({
      ...day,
      date,
      dateDisplay: date,
      weekday,
      weekdayName: weekday,
      tithis: day.tithis.map((tithi, i) => {
        const number = i === 0 ? first : second;
        return { ...tithi, number, key: tithiName(number).replace(/\s/g, ''), name: tithiName(number) };
      }),
      guidance: { ...day.guidance, rating, ratingName: rating, icon: '', headline: `${rating} Day` },
      ...(day.goodTime && {
        goodTime: {
          ...day.goodTime,
          date,
          dateDisplay: date,
          status: { status: goodTimeStatus.status, name: goodTimeStatus.name, icon: null },
          goodTimeCount: goodTimeStatus.status === 'HighlyFavorable' ? 1 : 0,
          bestGoodTime: goodTimeStatus.status === 'HighlyFavorable' ? day.goodTime.bestGoodTime : null,
          noGoodTimeReason: goodTimeStatus.status === 'HighlyFavorable' ? null : 'NO_QUALIFYING_PERIOD',
        },
      }),
    });
  }
  return { ...base, days };
}

const DAY_MS = 86_400_000;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:\d{2}$/;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const RATINGS = ['Favorable', 'Mixed', 'Caution'] as const;
const GOOD_TIME_STATUSES = [
  { status: 'HighlyFavorable', name: 'Highly Favorable' },
  { status: 'Mixed', name: 'Mixed' },
  { status: 'Avoid', name: 'Avoid' },
] as const;
const TITHI_NAMES = [
  'Pratipada',
  'Dwitiya',
  'Tritiya',
  'Chaturthi',
  'Panchami',
  'Shashthi',
  'Saptami',
  'Ashtami',
  'Navami',
  'Dashami',
  'Ekadashi',
  'Dwadashi',
  'Trayodashi',
  'Chaturdashi',
] as const;

function tithiName(number: number): string {
  if (number === 15) return 'Purnima';
  if (number === 30) return 'Amavasya';
  return number < 15 ? `Shukla ${TITHI_NAMES[number - 1]}` : `Krishna ${TITHI_NAMES[number - 16]}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

function parseOffset(suffix: string): number {
  const sign = suffix.startsWith('-') ? -1 : 1;
  const [hours, minutes] = suffix.slice(1).split(':').map(Number) as [number, number];
  return sign * (hours * 60 + minutes) * 60_000;
}

function formatInstant(ms: number, offsetMs: number, suffix: string): string {
  return `${new Date(ms + offsetMs).toISOString().slice(0, 19)}${suffix}`;
}
