import { fixtures } from '@myvedicstar/testing';
import { describe, expect, it } from 'vitest';

import { buildDayDashboard, periodState, toneForClassification } from './index';

const at = (localTime: string, date = '2026-09-29') => Date.parse(`${date}T${localTime}:00-05:00`); // Austin, CDT
const austin = fixtures.panchang.austinTelugu;

describe('buildDayDashboard', () => {
  it('shows the four limbs in force now, each with what comes next', () => {
    const dashboard = buildDayDashboard(austin, at('18:00'))!;
    expect(dashboard.limbs.tithi?.current.name).toBe('Krishna Chaturthi');
    expect(dashboard.limbs.tithi?.next?.name).toBe('Krishna Panchami');
    expect(dashboard.limbs.nakshatra?.current.name).toBe('Bharani');
    // Yoga Harshana ends 16:50 and Karana Bava 17:34: at 18:00 the next ones are in force.
    expect(dashboard.limbs.yoga?.current.name).toBe('Vajra');
    expect(dashboard.limbs.karana?.current.name).toBe('Balava');
    expect(dashboard.limbs.karana?.next?.name).toBe('Kaulava');
    expect(dashboard.weekdayName).toBe('Tuesday');
    expect(dashboard.summary.headline).toBe('Mixed Day');
  });

  it('lists auspicious and avoid periods in time order with their state at the current instant', () => {
    const dashboard = buildDayDashboard(austin, at('10:00'))!;
    expect(dashboard.auspicious.map((p) => [p.period.kind, p.tone, p.state])).toEqual([
      ['AmritKalam', 'warning', 'upcoming'], // overlaps Rahu Kalam → resolved to a warning
    ]);
    expect(dashboard.avoid.map((p) => [p.period.kind, p.state])).toEqual([
      ['Varjyam', 'past'],
      ['DurMuhurtam', 'now'],
      ['Yamagandam', 'upcoming'],
      ['GulikaKalam', 'upcoming'],
      ['RahuKalam', 'upcoming'],
      ['DurMuhurtam', 'upcoming'],
    ]);
    expect(dashboard.avoid.find((p) => p.period.kind === 'GulikaKalam')?.tone).toBe('caution');
  });

  it('flags auspicious periods with the overlaps the backend resolved, with the overlapping part', () => {
    const dashboard = buildDayDashboard(austin, at('10:00'))!;
    // Amrit Kalam 16:36–18:06 overlaps Rahu Kalam 16:19–17:49 → the backend reports 16:36–17:49 to avoid.
    const amrit = dashboard.auspicious.find((p) => p.period.kind === 'AmritKalam')!;
    const rahu = dashboard.avoid.find((p) => p.period.kind === 'RahuKalam')!;
    expect(amrit.overlaps).toHaveLength(1);
    expect(amrit.overlaps[0]!.kind).toBe('RahuKalam');
    expect(amrit.overlaps[0]!.start).toBe(amrit.period.start);
    expect(amrit.overlaps[0]!.end).toBe(rahu.period.end);
    expect(dashboard.avoid.every((p) => p.overlaps.length === 0)).toBe(true);
  });

  it('never computes overlaps itself: a period without backend overlaps stays favorable', () => {
    const response = structuredClone(austin);
    const amrit = response.days[0]!.auspiciousPeriods.find((p) => p.kind === 'AmritKalam')!;
    delete amrit.overlaps;
    delete amrit.overlapMessage;
    const dashboard = buildDayDashboard(response, at('10:00'))!;
    expect(dashboard.auspicious.find((p) => p.period.kind === 'AmritKalam')).toMatchObject({
      tone: 'favorable',
      overlaps: [],
    });
  });

  it('resolves a favorable period with an unfavorable overlap to a warning — in lists and on the timeline', () => {
    // Hyderabad: Abhijit Muhurta 11:42–12:30 overlaps Gulika Kalam 12:06–13:36; Brahma Muhurta 04:30–05:18 overlaps
    // Varjyam 05:15–06:46.
    const hyderabad = fixtures.panchang.hyderabadAll;
    const dashboard = buildDayDashboard(hyderabad, Date.parse('2026-09-29T09:00:00+05:30'))!;
    const abhijit = dashboard.auspicious.find((p) => p.period.kind === 'AbhijitMuhurta')!;
    expect(abhijit.tone).toBe('warning');
    expect(abhijit.overlaps.map((o) => [o.kind, o.start.slice(11, 16), o.end.slice(11, 16)])).toEqual([
      ['GulikaKalam', '12:06', '12:30'],
    ]);
    expect(dashboard.auspicious.find((p) => p.period.kind === 'BrahmaMuhurta')!.tone).toBe('warning');
    expect(dashboard.auspicious.find((p) => p.period.kind === 'AmritKalam')!.tone).toBe('favorable');
    expect(dashboard.timeline.entries.find((e) => e.period.kind === 'AbhijitMuhurta')?.tone).toBe('warning');
  });

  it('places periods, sunset and now on a sunrise-to-sunrise timeline', () => {
    const { timeline } = buildDayDashboard(austin, at('13:21'))!;
    expect(timeline.start).toBe(austin.days[0]!.sunrise);
    expect(timeline.end).toBe(austin.days[0]!.nextSunrise);
    expect(timeline.sunsetAt).toBeGreaterThan(0.45);
    expect(timeline.sunsetAt).toBeLessThan(0.55);
    expect(timeline.nowAt).toBeGreaterThan(0.2);
    expect(timeline.nowAt).toBeLessThan(0.3);
    expect(timeline.entries.map((e) => e.from)).toEqual(
      [...timeline.entries.map((e) => e.from)].sort((a, b) => a - b),
    );
    for (const entry of timeline.entries) {
      expect(entry.from).toBeGreaterThanOrEqual(0);
      expect(entry.to).toBeLessThanOrEqual(1);
      expect(entry.to).toBeGreaterThan(entry.from);
    }
    expect(timeline.entries.find((e) => e.period.kind === 'GulikaKalam')?.state).toBe('now');
  });

  it('has no "now" marker for another date and treats its periods as upcoming', () => {
    const dashboard = buildDayDashboard(austin, at('10:00', '2026-10-05'))!;
    expect(dashboard.summary.isToday).toBe(false);
    expect(dashboard.timeline.nowAt).toBeUndefined();
    expect(dashboard.avoid.every((p) => p.state === 'upcoming')).toBe(true);
    expect(dashboard.limbs.yoga?.current.name).toBe('Harshana'); // at sunrise
  });

  it('explains the rating with the backend factors', () => {
    const dashboard = buildDayDashboard(austin, at('10:00'))!;
    expect(dashboard.ratingName).toBe('Mixed');
    expect(dashboard.factors.map((f) => [f.limbName, f.ratingName])).toEqual([
      ['Tithi', 'Caution'],
      ['Vara', 'Caution'],
      ['Nakshatra', 'Caution'],
      ['Yoga', 'Favorable'],
      ['Karana', 'Favorable'],
    ]);
  });

  it('returns undefined when the response has no days', () => {
    expect(buildDayDashboard({ ...austin, days: [] })).toBeUndefined();
  });
});

describe('period helpers', () => {
  it.each([
    ['HighlyFavorable', 'favorable'],
    ['Favorable', 'favorable'],
    ['Neutral', 'neutral'],
    ['Caution', 'caution'],
    ['Avoid', 'caution'],
    ['SomethingNew', 'neutral'],
  ])('%s → %s', (classification, tone) => {
    expect(toneForClassification(classification)).toBe(tone);
  });

  it('knows whether a period is past, now or upcoming', () => {
    const period = { start: '2026-09-29T10:00:00-05:00', end: '2026-09-29T11:00:00-05:00' };
    expect(periodState(period, at('09:59'))).toBe('upcoming');
    expect(periodState(period, at('10:30'))).toBe('now');
    expect(periodState(period, at('11:00'))).toBe('past');
  });
});
