import { describe, expect, it } from 'vitest';

import {
  coarsenCoordinate,
  createMemorySink,
  createObservability,
  REDACTED,
  redactProperties,
} from './index';

describe('redactProperties', () => {
  it('removes sensitive keys', () => {
    expect(
      redactProperties({
        Authorization: 'Bearer abc',
        accessToken: 'x',
        password: 'p',
        latitude: 30.2672,
        longitude: -97.7431,
        email: 'a@b.com',
        tradition: 'telugu',
      }),
    ).toEqual({
      Authorization: REDACTED,
      accessToken: REDACTED,
      password: REDACTED,
      latitude: REDACTED,
      longitude: REDACTED,
      email: REDACTED,
      tradition: 'telugu',
    });
  });

  it('scrubs tokens and emails inside values', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
    expect(redactProperties({ detail: `failed for me@example.com with ${jwt} and Bearer xyz.123` })).toEqual({
      detail: `failed for ${REDACTED} with ${REDACTED} and Bearer ${REDACTED}`,
    });
  });
});

describe('coarsenCoordinate', () => {
  it('reduces precision to roughly 11 km', () => {
    expect(coarsenCoordinate(30.2672)).toBe(30.3);
    expect(coarsenCoordinate(-97.7431)).toBe(-97.7);
  });
});

describe('createObservability', () => {
  it('only sends analytics with consent but always sends operational telemetry', () => {
    const sink = createMemorySink();
    let consent = false;
    const { analytics, telemetry } = createObservability({
      sinks: [sink],
      hasAnalyticsConsent: () => consent,
    });

    analytics.trackEvent('location_changed');
    telemetry.trackException(new Error('boom'));
    expect(sink.items.map((i) => i.type)).toEqual(['exception']);

    consent = true;
    analytics.trackScreen('Home');
    expect(sink.items.map((i) => i.type)).toEqual(['exception', 'screen']);
  });

  it('attaches redacted context to every item', () => {
    const sink = createMemorySink();
    const { telemetry } = createObservability({ sinks: [sink], hasAnalyticsConsent: () => true });
    telemetry.setContext({ appVersion: '1.0.0', token: 'secret' });
    telemetry.trackMetric('api.duration', 120, { operation: 'panchang.today' });
    expect(sink.items[0]).toMatchObject({
      properties: { appVersion: '1.0.0', token: REDACTED, operation: 'panchang.today' },
    });
  });

  it('isolates failing sinks', () => {
    const good = createMemorySink();
    const bad = {
      send: () => {
        throw new Error('sink down');
      },
    };
    const { telemetry } = createObservability({ sinks: [bad, good], hasAnalyticsConsent: () => true });
    expect(() => telemetry.trackMetric('x', 1)).not.toThrow();
    expect(good.items).toHaveLength(1);
  });
});
