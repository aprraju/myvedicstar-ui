import { createMemorySink } from '@myvedicstar/analytics';
import { parseAppConfig } from '@myvedicstar/config';
import { fixtures } from '@myvedicstar/testing';

import { createMobileServices } from './services';

describe('createMobileServices', () => {
  it('calls the backend through the shared typed client and records safe telemetry', async () => {
    const result = parseAppConfig({ environment: 'test', apiBaseUrl: 'https://api.test.example/api/v1' });
    if (!result.ok) throw new Error(result.issues.join());
    const sink = createMemorySink();
    const fetchImpl = jest.fn(
      async () =>
        new Response(JSON.stringify(fixtures.panchang.hyderabadAll), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof fetch;

    const services = createMobileServices(result.config, { sinks: [sink], fetchImpl });
    const today = await services.api.panchang.today({ location: { latitude: 17.385, longitude: 78.4867 } });

    expect(today.location.timeZone).toBe('Asia/Kolkata');
    expect(sink.items[0]).toMatchObject({
      name: 'api.duration',
      properties: { operation: 'panchang.today' },
    });
    expect(JSON.stringify(sink.items)).not.toContain('17.38');
  });
});
