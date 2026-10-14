import { buildPanchangWithoutOptionalPeriods, fixtures } from '@myvedicstar/testing';
import { describe, expect, it } from 'vitest';

import {
  bestGoodTimesResponseSchema,
  daySummariesResponseSchema,
  festivalsResponseSchema,
  goodTimeExplanationResponseSchema,
  goodTimesResponseSchema,
  locationSchema,
  muhurtaActivitiesResponseSchema,
  panchangResponseSchema,
  problemDetailsSchema,
  traditionsResponseSchema,
  userInfoSchema,
} from './index';

describe('contract schemas accept responses captured from the real API', () => {
  it('preserves backend-provided tithi short and compact labels', () => {
    const response = structuredClone(fixtures.panchang.austinTelugu);
    response.days[0]!.tithis[0]!.shortName = 'Chatur';
    response.days[0]!.tithis[0]!.compactName = 'P4';
    const parsed = panchangResponseSchema.parse(response);
    expect(parsed.days[0]!.tithis[0]).toMatchObject({ shortName: 'Chatur', compactName: 'P4' });
  });
  it('upcoming festivals', () => {
    expect(festivalsResponseSchema.safeParse(fixtures.festivals).success).toBe(true);
  });

  it('muhurta activities, day summaries and explanation', () => {
    expect(muhurtaActivitiesResponseSchema.safeParse(fixtures.muhurta.activities).success).toBe(true);
    expect(daySummariesResponseSchema.safeParse(fixtures.muhurta.daySummaries).success).toBe(true);
    expect(daySummariesResponseSchema.safeParse(fixtures.muhurta.daySummariesBusiness).success).toBe(true);
    expect(goodTimeExplanationResponseSchema.safeParse(fixtures.muhurta.explanation).success).toBe(true);
  });

  it.each(Object.entries(fixtures.muhurta.goodTimes))('good times fixture %s', (_name, fixture) => {
    expect(goodTimesResponseSchema.safeParse(fixture).success).toBe(true);
  });

  it.each(Object.entries(fixtures.muhurta.best))('best good times fixture %s', (_name, fixture) => {
    expect(bestGoodTimesResponseSchema.safeParse(fixture).success).toBe(true);
  });

  it('festival days offset from their anchor day have no observance window', () => {
    const response = structuredClone(fixtures.festivals);
    const timing = response.festivals[0]!.timing;
    Object.assign(timing, {
      observanceStart: null,
      observanceEnd: null,
      observanceStartDisplay: null,
      observanceEndDisplay: null,
    });
    expect(festivalsResponseSchema.safeParse(response).success).toBe(true);
  });

  it('user info (nullable names and email)', () => {
    expect(userInfoSchema.safeParse(fixtures.userInfo).success).toBe(true);
    expect(
      userInfoSchema.safeParse({ id: 'x', givenName: null, surname: null, name: null, email: null }).success,
    ).toBe(true);
  });

  it.each(Object.entries(fixtures.panchang))('panchang fixture %s', (_name, fixture) => {
    expect(panchangResponseSchema.safeParse(fixture).success).toBe(true);
  });

  it('location fixtures', () => {
    expect(locationSchema.safeParse(fixtures.location.austin).success).toBe(true);
    expect(locationSchema.safeParse(fixtures.location.hyderabadCoordinates).success).toBe(true);
  });

  it('traditions fixture', () => {
    expect(traditionsResponseSchema.safeParse(fixtures.traditions).success).toBe(true);
  });

  it('validation problem fixture', () => {
    const problem = problemDetailsSchema.parse(fixtures.problem.validation);
    expect(problem.status).toBe(400);
    expect(problem.errors?.Latitude).toHaveLength(1);
  });

  it('accepts a day with no optional periods', () => {
    expect(panchangResponseSchema.safeParse(buildPanchangWithoutOptionalPeriods()).success).toBe(true);
  });
});

describe('contract schemas', () => {
  it('reject instants without an offset', () => {
    const response = structuredClone(fixtures.panchang.austinTelugu);
    response.days[0]!.sunrise = '2026-09-29T07:23:20';
    expect(panchangResponseSchema.safeParse(response).success).toBe(false);
  });

  it('tolerate an unknown classification the UI does not know yet', () => {
    const response = structuredClone(fixtures.panchang.austinTelugu);
    response.days[0]!.inauspiciousPeriods[0]!.classification = 'SomethingNew';
    expect(panchangResponseSchema.safeParse(response).success).toBe(true);
  });

  it('ignore unknown fields added by a newer backend', () => {
    const response = { ...structuredClone(fixtures.panchang.austinTelugu), futureField: 1 };
    const parsed = panchangResponseSchema.parse(response);
    expect('futureField' in parsed).toBe(false);
  });
});
