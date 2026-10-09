import { ApiError } from '@myvedicstar/api-client';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { scenarios } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { createTestConfig, createTestServices } from '../../test/render';
import { createDisabledAuthClient } from '../auth';
import { installGlobalErrorHandlers } from '../errors/global-error-handlers';
import { createServices } from './services';

describe('app services', () => {
  it('reach the backend through the typed API client (mocked with MSW)', async () => {
    const { services } = createTestServices();
    const today = await services.api.panchang.today({
      location: { place: 'Austin, Texas, USA' },
      tradition: 'telugu',
    });
    expect(today.location.timeZone).toBe('America/Chicago');
    expect(today.tradition.key).toBe('telugu');
  });

  it('record API telemetry without location or credentials', async () => {
    const { services, telemetry } = createTestServices();
    await services.api.panchang.today({ location: { latitude: 30.2672, longitude: -97.7431 } });

    const metric = telemetry.items.find((item) => item.name === 'api.duration');
    expect(metric).toMatchObject({
      type: 'metric',
      properties: { operation: 'panchang.today', status: 200, outcome: 'success', platform: 'web' },
    });
    const serialized = JSON.stringify(telemetry.items);
    expect(serialized).not.toContain('30.2');
    expect(serialized).not.toContain('97.7');
  });

  it('normalize server failures into application errors', async () => {
    server.use(scenarios.serverError('/traditions'));
    const { services } = createTestServices();
    const error = await services.api.traditions.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'server', status: 500, correlationId: 'corr-500' });
  });

  it('normalize network failures', async () => {
    server.use(scenarios.networkError('/traditions'));
    const { services } = createTestServices();
    await expect(services.api.traditions.list()).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('telemetry from runtime configuration', () => {
  const ingestion = 'https://westus-0.in.applicationinsights.azure.com';
  const connectionString = `InstrumentationKey=00000000-1111-2222-3333-444444444444;IngestionEndpoint=${ingestion}/`;

  it('sends to Application Insights when the environment enables it, flushing when the page is hidden', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${ingestion}/v2/track`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ itemsReceived: 1, itemsAccepted: 1 });
      }),
    );
    const services = createServices(createTestConfig({ telemetry: { enabled: true, connectionString } }), {
      auth: createDisabledAuthClient(),
    });
    services.telemetry.trackMetric('auth.signInFailed', 1, { reason: 'cancelled' });
    window.dispatchEvent(new Event('pagehide'));

    await expect.poll(() => bodies.length).toBe(1);
    expect(JSON.stringify(bodies)).toContain('auth.signInFailed');
    expect(JSON.stringify(bodies)).toContain('"environment":"test"');
  });

  it('reports errors that escape React', () => {
    const { services, telemetry } = createTestServices();
    // A detached target: jsdom would report errors dispatched on the real window as uncaught test errors.
    const target = new EventTarget() as Window;
    const uninstall = installGlobalErrorHandlers(services.telemetry, target);
    target.dispatchEvent(new ErrorEvent('error', { error: new TypeError('boom'), message: 'boom' }));
    uninstall();
    target.dispatchEvent(new ErrorEvent('error', { error: new TypeError('again'), message: 'again' }));

    const exceptions = telemetry.items.filter((item) => item.type === 'exception');
    expect(exceptions).toEqual([expect.objectContaining({ name: 'TypeError', message: 'boom' })]);
  });
});
