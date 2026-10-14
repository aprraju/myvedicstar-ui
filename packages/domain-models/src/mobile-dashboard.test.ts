import { fixtures } from '@myvedicstar/testing';
import { describe, expect, it } from 'vitest';

import { buildDayDashboard } from './day-dashboard';
import { dashboardFactorReason, dashboardFirstName, mobilePeriodOrder } from './mobile-dashboard';

describe('mobile dashboard presentation', () => {
  it('puts remaining periods first without changing interval data or resolved conflicts', () => {
    const dashboard = buildDayDashboard(
      fixtures.panchang.austinTelugu,
      Date.parse('2026-09-29T10:00:00-05:00'),
    )!;
    const items = [...dashboard.auspicious, ...dashboard.avoid];
    const original = structuredClone(items);
    const ordered = mobilePeriodOrder(items);
    expect(ordered.slice(0, -1).some((item) => item.state !== 'past')).toBe(true);
    expect(ordered.findIndex((item) => item.state === 'past')).toBeGreaterThan(0);
    expect(ordered).toHaveLength(original.length);
    expect(ordered.filter((item) => item.overlaps.length).every((item) => item.tone === 'warning')).toBe(
      true,
    );
    expect(items).toEqual(original);
    for (const item of ordered) expect(items).toContain(item);
  });

  it.each([
    ['Raju,Bhupathi', 'Raju'],
    [' Asha Rao ', 'Asha'],
    ['श्री विद्या', 'श्री'],
    ['', undefined],
    [undefined, undefined],
  ])('uses the profile first name from %s', (name, expected) => {
    expect(dashboardFirstName(name)).toBe(expected);
  });

  it('retains backend factor explanations without repeating their headings', () => {
    const dashboard = buildDayDashboard(fixtures.panchang.austinTelugu)!;
    const factor = dashboard.factors[0]!;
    expect(dashboardFactorReason(factor)).toBeTruthy();
    expect(factor.reason).toContain(dashboardFactorReason(factor));
  });
});
