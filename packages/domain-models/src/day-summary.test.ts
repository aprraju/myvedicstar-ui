import { buildPanchangResponse, fixtures } from '@myvedicstar/testing';
import { describe, expect, it } from 'vitest';

import { buildDaySummary, firstSentence, stripLeadingIcon, toneForRating } from './index';

const at = (localTime: string) => Date.parse(`2026-09-29T${localTime}:00-05:00`); // Austin, CDT
const austin = fixtures.panchang.austinTelugu;

describe('buildDaySummary', () => {
  it('summarises the day from backend guidance', () => {
    const summary = buildDaySummary(austin, at('10:00'))!;
    expect(summary).toMatchObject({
      date: '2026-09-29',
      timeZone: 'America/Chicago',
      isToday: true,
      rating: 'Mixed',
      tone: 'mixed',
      headline: 'Mixed Day',
      description: "Today's Panchang factors are mixed; choose timings carefully for important activities.",
      paksha: 'krishna',
    });
    expect(summary.tithi?.current.key).toBe('KrishnaChaturthi');
    expect(summary.tithi?.next?.key).toBe('KrishnaPanchami');
  });

  it('takes the day status from the General evaluation and keeps the day-factor headline', () => {
    const summary = buildDaySummary(austin, at('10:00'))!;
    expect(summary.dayStatus).toMatchObject({ status: 'Mixed' });
    expect(summary.rating).toBe('Mixed');
  });

  it('shows no Good Time until the evaluation has loaded (never derived from Panchang periods)', () => {
    expect(buildDaySummary(austin, at('10:00'))!.goodTime).toEqual({ status: 'unavailable' });
  });

  it('reports the caution period in progress, including caution-class periods', () => {
    const rahu = buildDaySummary(austin, at('16:30'))!;
    expect(rahu.caution).toMatchObject({ status: 'now', window: { kind: 'RahuKalam' } });
    const gulika = buildDaySummary(austin, at('13:30'))!;
    expect(gulika.caution).toMatchObject({ status: 'now', window: { kind: 'GulikaKalam' } });
  });

  it('reports the next caution period, even after midnight', () => {
    expect(buildDaySummary(austin, at('11:55'))!.caution).toMatchObject({
      status: 'next',
      window: { kind: 'GulikaKalam' },
    });
    expect(buildDaySummary(austin, at('20:00'))!.caution).toMatchObject({
      status: 'next',
      window: { kind: 'DurMuhurtam', start: expect.stringMatching(/^2026-09-30T00:08/) },
    });
  });

  it('follows a Tithi transition during the day', () => {
    const avoidDay = fixtures.panchang.austinAvoid; // Krishna Chaturdashi → Amavasya → Shukla Pratipada
    const [chaturdashi, amavasya] = avoidDay.days[0]!.tithis;
    const summary = buildDaySummary(avoidDay, Date.parse(amavasya!.start) + 60_000)!;
    expect(summary.tithi?.current.key).toBe('Amavasya');
    expect(summary.tithi?.next?.key).toBe('ShuklaPratipada');
    expect(chaturdashi?.key).toBe('KrishnaChaturdashi');
    expect(summary.paksha).toBe('krishna');
  });

  it('marks another date as not today', () => {
    const summary = buildDaySummary(fixtures.panchang.austinPurnima, at('10:00'))!;
    expect(summary.isToday).toBe(false);
    expect(summary.paksha).toBe('shukla');
    expect(summary.tithi?.current.key).toBe('Purnima');
  });

  it.each([
    ['austinHighlyFavorable', 'highly-favorable'],
    ['austinFavorable', 'highly-favorable'],
    ['austinTelugu', 'mixed'],
    ['austinCaution', 'mixed'],
    ['austinAvoid', 'avoid'],
  ] as const)('maps the General day status of %s to the %s tone', (name, tone) => {
    expect(buildDaySummary(fixtures.panchang[name])!.tone).toBe(tone);
  });

  it('falls back to the day-factor rating when the response has no General day status', () => {
    const older = buildPanchangResponse(fixtures.panchang.austinCaution, (day) => {
      delete day.goodTime;
    });
    expect(buildDaySummary(older)!.tone).toBe('caution');
  });

  it('handles a response with no days', () => {
    expect(buildDaySummary({ ...austin, days: [] })).toBeUndefined();
  });
});

describe('helpers', () => {
  it('treat unknown ratings as mixed', () => {
    expect(toneForRating('SomethingNew')).toBe('mixed');
  });

  it('strip the rating icon from headlines', () => {
    expect(stripLeadingIcon('🟢 Favorable Day', '🟢')).toBe('Favorable Day');
    expect(stripLeadingIcon('Favorable Day', '🟢')).toBe('Favorable Day');
  });

  it('take the first sentence in any script', () => {
    expect(firstSentence('One. Two.')).toBe('One.');
    expect(firstSentence('आज शुभ है। कल नहीं।')).toBe('आज शुभ है।');
    expect(firstSentence('No terminator')).toBe('No terminator');
  });
});

describe('Good Time from the General evaluation', () => {
  // Austin, 2026-10-20: Good Times 07:36–09:52 (best), plus later ones; Abhijit over Varjyam is Caution 12:52–13:15.
  const evaluation = fixtures.muhurta.goodTimes.austinGeneral;
  const panchang = buildPanchangResponse(austin, (day) => {
    day.date = evaluation.date;
  });
  const on = (localTime: string) => Date.parse(`${evaluation.date}T${localTime}:00-05:00`);
  const goodSegments = evaluation.segments.filter((segment) => segment.isGoodTime);

  it('reports the Good Time in progress', () => {
    const summary = buildDaySummary(panchang, on('08:00'), evaluation)!;
    expect(summary.goodTime).toMatchObject({ status: 'now', window: { start: goodSegments[0]!.start } });
  });

  it('reports the next Good Time when none is in progress', () => {
    const summary = buildDaySummary(panchang, on('07:00'), evaluation)!;
    expect(summary.goodTime).toMatchObject({ status: 'next', window: { start: goodSegments[0]!.start } });
  });

  it('never treats a Mixed or Caution segment as a Good Time', () => {
    const caution = evaluation.segments.find((segment) => segment.status.status === 'Caution')!;
    const inside = Date.parse(caution.start) + 60_000;
    const summary = buildDaySummary(panchang, inside, evaluation)!;
    expect(summary.goodTime.status).toBe('next');
    expect(
      summary.goodTime.status === 'next' &&
        'isGoodTime' in summary.goodTime.window &&
        summary.goodTime.window.isGoodTime,
    ).toBe(true);
  });

  it('reports none after the last Good Time', () => {
    expect(buildDaySummary(panchang, on('23:30'), evaluation)!.goodTime).toEqual({ status: 'none' });
  });

  it('ignores an evaluation of another date', () => {
    expect(buildDaySummary(austin, at('10:00'), evaluation)!.goodTime).toEqual({ status: 'unavailable' });
  });

  it("carries the backend's message when the day has no Good Time", () => {
    const excluded = fixtures.muhurta.goodTimes.hyderabadExcluded;
    const day = buildPanchangResponse(fixtures.panchang.hyderabadAll, (d) => {
      d.date = excluded.date;
    });
    const summary = buildDaySummary(day, Date.parse(`${excluded.date}T10:00:00+05:30`), excluded)!;
    expect(summary.goodTime).toEqual({ status: 'none' });
    expect(summary.noGoodTimeMessage).toBe(excluded.noGoodTimeMessage);
  });
});
