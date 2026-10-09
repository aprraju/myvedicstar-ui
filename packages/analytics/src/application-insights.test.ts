import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplicationInsightsSink, createObservability } from './index';

const IKEY = '00000000-1111-2222-3333-444444444444';

function setup(options: { sampleRate?: number; random?: () => number; maxBatchSize?: number } = {}) {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
  const sink = createApplicationInsightsSink({
    instrumentationKey: IKEY,
    ingestionEndpoint: 'https://eastus-8.in.applicationinsights.azure.com/',
    roleName: 'myvedicstar-web',
    fetchImpl,
    ...options,
  });
  const { telemetry, analytics } = createObservability({ sinks: [sink], hasAnalyticsConsent: () => true });
  const sent = () =>
    fetchImpl.mock.calls.flatMap(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>[]);
  return { sink, telemetry, analytics, fetchImpl, sent };
}

afterEach(() => vi.useRealTimers());

describe('Application Insights sink', () => {
  it('batches redacted items to the ingestion track endpoint', () => {
    const { sink, telemetry, fetchImpl, sent } = setup();
    telemetry.trackMetric('api.duration', 120, {
      operation: 'panchang.today',
      status: 200,
      accessToken: 'eyJ',
    });
    telemetry.trackException(new Error('failed for a@b.com'));
    expect(fetchImpl).not.toHaveBeenCalled();

    sink.flush();
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://eastus-8.in.applicationinsights.azure.com/v2/track');
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
    });

    const [metric, exception] = sent();
    expect(metric).toMatchObject({
      name: 'Microsoft.ApplicationInsights.00000000111122223333444444444444.Metric',
      iKey: IKEY,
      tags: { 'ai.cloud.role': 'myvedicstar-web' },
      data: {
        baseType: 'MetricData',
        baseData: {
          metrics: [{ name: 'api.duration', value: 120, count: 1 }],
          properties: { operation: 'panchang.today', status: '200', accessToken: '[redacted]' },
        },
      },
    });
    expect(exception).toMatchObject({
      data: { baseType: 'ExceptionData', baseData: { exceptions: [{ typeName: 'Error' }] } },
    });
    expect(JSON.stringify(sent())).not.toContain('a@b.com');
  });

  it('flushes on a timer and when the batch is full', () => {
    vi.useFakeTimers();
    const { analytics, fetchImpl } = setup({ maxBatchSize: 2 });
    analytics.trackScreen('home');
    vi.advanceTimersByTime(5_000);
    expect(fetchImpl).toHaveBeenCalledOnce();

    analytics.trackEvent('a');
    analytics.trackEvent('b');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('sends nothing for sessions outside the sample', () => {
    const { sink, telemetry, fetchImpl } = setup({ sampleRate: 0.25, random: () => 0.9 });
    telemetry.trackMetric('m', 1);
    sink.flush();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never throws when the endpoint is unreachable', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    const sink = createApplicationInsightsSink({
      instrumentationKey: IKEY,
      ingestionEndpoint: 'https://x.in.applicationinsights.azure.com',
      roleName: 'web',
      fetchImpl,
    });
    sink.send({ type: 'metric', name: 'm', value: 1, properties: {} });
    expect(() => sink.flush()).not.toThrow();
    await Promise.resolve();
  });
});
