import { fixtures } from '@myvedicstar/testing';
import { describe, expect, it, vi } from 'vitest';

import { ApiError, createApiClient, queryKeys, retryDelayMs, shouldRetryQuery } from './index';
import type { RequestMetrics } from './transport';

const BASE_URL = 'https://api.test.example/api/v1';

function jsonResponse(body: unknown, init: ResponseInit & { headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

function setup(fetchImpl: typeof fetch, extra: Partial<Parameters<typeof createApiClient>[0]> = {}) {
  const metrics: RequestMetrics[] = [];
  const client = createApiClient({
    baseUrl: `${BASE_URL}/`,
    fetchImpl,
    getAccessToken: async () => 'test-access-token',
    createCorrelationId: () => 'corr-123',
    onRequestComplete: (m) => metrics.push(m),
    ...extra,
  });
  return { client, metrics };
}

describe('createApiClient', () => {
  it.each(['countries', 'regions', 'addressCities'] as const)(
    'authenticates the %s address lookup through APIM',
    async (operation) => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ results: [] }));
      const { client } = setup(fetchImpl);
      const lookup = () => {
        if (operation === 'countries') return client.locations.countries();
        if (operation === 'regions') return client.locations.regions('US');
        return client.locations.addressCities('Liberty Hill', 'US', undefined);
      };
      await lookup();
      expect(new Headers(fetchImpl.mock.calls[0]![1]?.headers).get('Authorization')).toBe(
        'Bearer test-access-token',
      );
      const anonymous = setup(fetchImpl, { getAccessToken: async () => null }).client;
      fetchImpl.mockClear();
      const request =
        operation === 'countries'
          ? anonymous.locations.countries()
          : operation === 'regions'
            ? anonymous.locations.regions('US')
            : anonymous.locations.addressCities('Liberty Hill', 'US', undefined);
      await expect(request).rejects.toMatchObject({ kind: 'authentication' });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
  it.each(['wrapped', 'array'])('loads the %s birth-star catalog in display order', async (shape) => {
    const stars = [
      { key: 'Bharani', name: 'Bharani', order: 2 },
      { key: 'Ashwini', name: 'Ashwini', order: 1 },
    ];
    const payload = shape === 'wrapped' ? { language: 'en', nakshatras: stars } : stars;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(payload));
    const { client } = setup(fetchImpl);
    expect(await client.muhurta.nakshatras()).toEqual([stars[1], stars[0]]);
    expect(fetchImpl.mock.calls[0]![0]).toBe(`${BASE_URL}/muhurta/nakshatras`);
  });

  it('builds the request URL, rounds coordinates and sends a correlation ID', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(fixtures.panchang.hyderabadAll));
    const { client } = setup(fetchImpl);

    const result = await client.panchang.today({
      location: { latitude: 17.385044, longitude: 78.486671 },
      tradition: 'all',
      language: 'en',
    });

    expect(result.location.timeZone).toBe('Asia/Kolkata');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/panchang/today?latitude=17.39&longitude=78.49&tradition=all&language=en`);
    expect(new Headers(init?.headers).get('X-Correlation-ID')).toBe('corr-123');
    expect(init?.credentials).toBe('omit');
  });

  it('encodes path segments', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(fixtures.panchang.austinTelugu));
    const { client } = setup(fetchImpl);
    await client.panchang.date('2026-09-29', { location: { place: 'Austin, Texas, USA' } });
    expect(fetchImpl.mock.calls[0]![0]).toBe(`${BASE_URL}/panchang/2026-09-29?place=Austin%2C+Texas%2C+USA`);
  });

  it('uses the OpenAPI query parameter names (timeZone) and path templates', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(fixtures.panchang.austinTelugu));
    const { client } = setup(fetchImpl);
    await client.panchang.month(2026, 9, {
      location: { latitude: 30.27, longitude: -97.74, timeZone: 'America/Chicago' },
      tradition: 'telugu',
    });
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      `${BASE_URL}/panchang/month/2026/9?latitude=30.27&longitude=-97.74&timeZone=America%2FChicago&tradition=telugu`,
    );
  });

  it('sends the tradition and language for the glossary', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(fixtures.glossary));
    const { client } = setup(fetchImpl);
    const glossary = await client.panchang.glossary({ tradition: 'tamil', language: 'en' });
    expect(glossary.sections.periods).toBeDefined();
    expect(fetchImpl.mock.calls[0]![0]).toBe(`${BASE_URL}/panchang/glossary?tradition=tamil&language=en`);
  });

  it('takes endpoint paths from configuration', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse(fixtures.panchang.austinTelugu));
    const { client } = setup(fetchImpl, {
      endpoints: { panchangToday: '/daily/today', panchangDate: '/daily/{date}' },
    });
    await client.panchang.today({ location: { place: 'Austin, TX' } });
    await client.panchang.date('2026-09-29', { location: { place: 'Austin, TX' } });
    expect(fetchImpl.mock.calls.map(([url]) => String(url).split('?')[0])).toEqual([
      `${BASE_URL}/daily/today`,
      `${BASE_URL}/daily/2026-09-29`,
    ]);
  });

  it('refuses endpoint paths that could leave the API base URL', () => {
    expect(() => setup(vi.fn(), { endpoints: { traditions: 'https://evil.example/x' } })).toThrow(
      /Invalid endpoint "traditions"/,
    );
    expect(() => setup(vi.fn(), { endpoints: { panchangYear: '/panchang/year' } })).toThrow(/\{year\}/);
  });

  it('attaches a bearer token when available without logging it in metrics', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(fixtures.panchang.austinTelugu));
    const { client, metrics } = setup(fetchImpl, { getAccessToken: async () => 'secret-token' });
    await client.panchang.today({ location: { place: 'Austin, TX' } });

    expect(new Headers(fetchImpl.mock.calls[0]![1]?.headers).get('Authorization')).toBe(
      'Bearer secret-token',
    );
    expect(JSON.stringify(metrics)).not.toContain('secret-token');
    expect(JSON.stringify(metrics)).not.toContain('Austin');
    expect(metrics[0]).toMatchObject({ operation: 'panchang.today', status: 200, outcome: 'success' });
  });

  it.each([
    [
      'traditions.list',
      (client: ReturnType<typeof setup>['client']) => client.traditions.list('en'),
      fixtures.traditions,
    ],
    [
      'panchang.glossary',
      (client: ReturnType<typeof setup>['client']) => client.panchang.glossary(),
      { language: 'en', sections: {} },
    ],
    [
      'locations.resolve',
      (client: ReturnType<typeof setup>['client']) => client.locations.resolve({ place: 'Austin, TX' }),
      fixtures.location.austin,
    ],
  ] as const)('%s requires authentication', async (_name, call, body) => {
    const signedIn = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(body));
    await call(setup(signedIn, { getAccessToken: async () => 'token-1' }).client);
    expect(new Headers(signedIn.mock.calls[0]![1]?.headers).get('Authorization')).toBe('Bearer token-1');

    const signedOut = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(body));
    const client = setup(signedOut, { getAccessToken: async () => null }).client;
    await expect(call(client)).rejects.toMatchObject({ kind: 'authentication' });
    expect(signedOut).not.toHaveBeenCalled();
  });

  it('never sends any application request without a token', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(fixtures.panchang.austinTelugu));
    const { client } = setup(fetchImpl, { getAccessToken: async () => null });
    const params = { location: { place: 'Austin, TX' } };
    const calls = [
      () => client.panchang.today(params),
      () => client.locations.resolve(params.location),
      () => client.locations.countries(),
      () => client.locations.regions('US'),
      () => client.locations.addressCities('Austin', 'US', 'TX'),
      () => client.locations.search({ text: 'Austin' }),
      () => client.locations.postal({ text: '78701' }),
      () => client.locations.reverse(30.27, -97.74),
      () => client.locations.timezone(30.27, -97.74),
      () => client.traditions.list(),
      () => client.panchang.traditions(),
      () => client.panchang.glossary(),
      () => client.panchang.tomorrow(params),
      () => client.panchang.tenDays(params),
      () => client.panchang.date('2026-10-11', params),
      () => client.panchang.range('2026-10-11', 3, params),
      () => client.panchang.month(2026, 10, params),
      () => client.panchang.year(2026, params),
      () => client.festivals.upcoming(params),
      () => client.muhurta.activities(),
      () => client.muhurta.nakshatras(),
      () => client.muhurta.goodTimes(params),
      () => client.muhurta.explanation(params),
      () => client.muhurta.daySummaries('2026-10-11', 3, params),
      () => client.muhurta.bestGoodTimes(params),
      () => client.auth.userInfo(),
      () =>
        client.contact.submit({
          name: 'Asha',
          email: 'asha@example.com',
          reason: 'other',
          message: 'Please contact me.',
        }),
    ];
    for (const call of calls) await expect(call()).rejects.toMatchObject({ kind: 'authentication' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requests upcoming festivals for the location, tradition, language and day count, with the token', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(fixtures.festivals));
    const { client } = setup(fetchImpl, { getAccessToken: async () => 'token-1' });
    const result = await client.festivals.upcoming({
      location: { latitude: 30.2672, longitude: -97.7431, timeZone: 'America/Chicago' },
      tradition: 'telugu',
      language: 'en',
      days: 60,
    });
    expect(result.festivals.length).toBeGreaterThan(0);
    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.pathname).toBe('/api/v1/festivals/upcoming');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      latitude: '30.27',
      longitude: '-97.74',
      timeZone: 'America/Chicago',
      tradition: 'telugu',
      language: 'en',
      days: '60',
    });
    expect(new Headers(fetchImpl.mock.calls[0]![1]?.headers).get('Authorization')).toBe('Bearer token-1');
  });

  it('evaluates good times for an activity, date and location', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(fixtures.muhurta.goodTimes.austinGeneral));
    const { client } = setup(fetchImpl);
    const result = await client.muhurta.goodTimes({
      location: { latitude: 30.2672, longitude: -97.7431 },
      tradition: 'telugu',
      language: 'en',
      date: '2026-10-20',
      activity: 'general',
      otherText: 'ignored unless activity is other',
    });
    expect(result.goodTimes.length).toBeGreaterThan(0);
    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.pathname).toBe('/api/v1/muhurta/good-times');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      latitude: '30.27',
      longitude: '-97.74',
      tradition: 'telugu',
      language: 'en',
      date: '2026-10-20',
      activity: 'general',
    });
  });

  it('sends the trimmed description only for the Other activity', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(fixtures.muhurta.goodTimes.austinOther));
    const { client } = setup(fetchImpl);
    await client.muhurta.goodTimes({
      location: { place: 'Austin, TX' },
      activity: 'other',
      otherText: '  Opening a bakery  ',
    });
    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.searchParams.get('otherText')).toBe('Opening a bakery');
  });

  it('requests activities, explanations and day summaries from their endpoints', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(fixtures.muhurta.activities))
      .mockResolvedValueOnce(jsonResponse(fixtures.muhurta.explanation))
      .mockResolvedValueOnce(jsonResponse(fixtures.muhurta.daySummaries));
    const { client } = setup(fetchImpl);
    const location = { place: 'Austin, TX' };
    await client.muhurta.activities({ tradition: 'telugu', language: 'en' });
    await client.muhurta.explanation({ location, activity: 'general', date: '2026-10-20' });
    const summaries = await client.muhurta.daySummaries('2026-10-01', 31, { location });
    expect(summaries.days).toHaveLength(31);
    expect(fetchImpl.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/api/v1/muhurta/activities',
      '/api/v1/muhurta/good-times/explanation',
      '/api/v1/muhurta/day-summaries',
    ]);
    expect(new URL(String(fetchImpl.mock.calls[2]![0])).searchParams.get('days')).toBe('31');
  });

  it('requests the next best good times and month summaries with the activity and Other text', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(fixtures.muhurta.best.austinOther))
      .mockResolvedValueOnce(jsonResponse(fixtures.muhurta.daySummariesBusiness));
    const { client } = setup(fetchImpl);
    const location = { latitude: 30.2672, longitude: -97.7431 };

    const best = await client.muhurta.bestGoodTimes({
      location,
      tradition: 'telugu',
      activity: 'other',
      otherText: ' Opening a bakery shop ',
      count: 3,
    });
    await client.muhurta.daySummaries('2026-10-01', 31, {
      location,
      activity: 'business',
      otherText: 'ignored',
    });

    expect(best.options.map((option) => option.rank)).toEqual([1, 2, 3]);
    const [bestUrl, monthUrl] = fetchImpl.mock.calls.map(([url]) => new URL(String(url)));
    expect(bestUrl!.pathname).toBe('/api/v1/muhurta/good-times/best');
    expect(Object.fromEntries(bestUrl!.searchParams)).toEqual({
      latitude: '30.27',
      longitude: '-97.74',
      tradition: 'telugu',
      activity: 'other',
      otherText: 'Opening a bakery shop',
      count: '3',
    });
    expect(monthUrl!.searchParams.get('activity')).toBe('business');
    expect(monthUrl!.searchParams.has('otherText')).toBe(false);
  });

  it('keys best good times and summaries by activity and Other text', () => {
    const base = { location: { place: 'Austin, TX' } };
    expect(queryKeys.muhurta.bestGoodTimes({ ...base, activity: 'travel' })).not.toEqual(
      queryKeys.muhurta.bestGoodTimes({ ...base, activity: 'business' }),
    );
    expect(queryKeys.muhurta.bestGoodTimes({ ...base, activity: 'other', otherText: 'Bakery ' })).toEqual(
      queryKeys.muhurta.bestGoodTimes({ ...base, activity: 'other', otherText: 'bakery' }),
    );
    expect(queryKeys.muhurta.daySummaries('2026-10-01', 31, { ...base, activity: 'business' })).not.toEqual(
      queryKeys.muhurta.daySummaries('2026-10-01', 31, { ...base, activity: 'travel' }),
    );
  });

  it('completes sign-in with POST /auth/userinfo and the access token', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(fixtures.userInfo));
    const { client } = setup(fetchImpl, { getAccessToken: async () => 'token-1' });
    expect(await client.auth.userInfo()).toEqual(fixtures.userInfo);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(new URL(String(url)).pathname).toBe('/api/v1/auth/userinfo');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token-1');
    // The API gateway answers 415 to a POST without a Content-Type.
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(init?.body).toBe('{}');
  });

  it('never calls /auth/userinfo without a token', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const { client } = setup(fetchImpl, { getAccessToken: async () => null });
    await expect(client.auth.userInfo()).rejects.toMatchObject({ kind: 'authentication' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('submits the Contact Us form as JSON and accepts an empty 202', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    const { client } = setup(fetchImpl);
    const body = {
      name: 'Asha',
      email: 'asha@example.com',
      reason: 'technical',
      message: 'The calendar looks wrong.',
    };
    await expect(client.contact.submit(body)).resolves.toBeUndefined();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(new URL(String(url)).pathname).toBe('/api/v1/contact');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(body);
  });

  it('normalizes validation Problem Details without exposing server text in the message', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(fixtures.problem.validation, {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    );
    const { client } = setup(fetchImpl);

    const error = await client.locations.resolve({ latitude: 95, longitude: 10 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.kind).toBe('validation');
    expect(apiError.fieldErrors?.Latitude).toHaveLength(1);
    expect(apiError.correlationId).toBe(fixtures.problem.validation.correlationId);
    expect(apiError.message).not.toContain('Latitude');
  });

  it.each([
    [401, 'authentication'],
    [403, 'authorization'],
    [404, 'notFound'],
    [429, 'rateLimit'],
    [500, 'server'],
    [503, 'server'],
  ] as const)('maps HTTP %i to %s', async (status, kind) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('internal stack trace', { status }));
    const onUnauthorized = vi.fn();
    const { client } = setup(fetchImpl, { onUnauthorized });

    const error = (await client.traditions.list().catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe(kind);
    expect(error.message).not.toContain('stack');
    expect(onUnauthorized).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
  });

  it('keeps 422 business-rule detail for display', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse(
          { status: 422, title: 'x', detail: 'No sunrise on this date at this location.' },
          { status: 422 },
        ),
      );
    const { client } = setup(fetchImpl);
    const error = (await client.panchang
      .today({ location: { latitude: 80, longitude: 0 } })
      .catch((e: unknown) => e)) as ApiError;
    expect(error.detail).toBe('No sunrise on this date at this location.');
  });

  it('reports network failures', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    const { client, metrics } = setup(fetchImpl);
    const error = (await client.traditions.list().catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe('network');
    expect(metrics[0]).toMatchObject({ outcome: 'error', errorKind: 'network' });
  });

  it('times out slow requests', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }),
      );
      const { client } = setup(fetchImpl, { timeoutMs: 1000 });
      const pending = client.traditions.list().catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(1001);
      expect(((await pending) as ApiError).kind).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports caller cancellation as cancelled', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const { client } = setup(fetchImpl);
    const pending = client.traditions.list(undefined, { signal: controller.signal }).catch((e: unknown) => e);
    controller.abort();
    expect(((await pending) as ApiError).kind).toBe('cancelled');
  });

  it('rejects responses that do not match the contract', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ unexpected: true }));
    const { client } = setup(fetchImpl);
    const error = (await client.traditions.list().catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe('unknown');
  });
});

describe('retry policy', () => {
  const error = (kind: ApiError['kind'], status?: number, retryAfterMs?: number) =>
    new ApiError({ kind, status, retryAfterMs });

  it('retries transient failures at most twice', () => {
    expect(shouldRetryQuery(0, error('network'))).toBe(true);
    expect(shouldRetryQuery(1, error('timeout'))).toBe(true);
    expect(shouldRetryQuery(2, error('network'))).toBe(false);
    expect(shouldRetryQuery(0, error('server', 503))).toBe(true);
  });

  it('does not retry client errors or deterministic server errors', () => {
    expect(shouldRetryQuery(0, error('validation', 400))).toBe(false);
    expect(shouldRetryQuery(0, error('authentication', 401))).toBe(false);
    expect(shouldRetryQuery(0, error('server', 500))).toBe(false);
    expect(shouldRetryQuery(0, new Error('boom'))).toBe(false);
  });

  it('honours Retry-After and otherwise backs off exponentially', () => {
    expect(retryDelayMs(0, error('rateLimit', 429, 3000))).toBe(3000);
    expect(retryDelayMs(0, error('network'), () => 0)).toBe(250);
    expect(retryDelayMs(3, error('network'), () => 1)).toBe(4000);
  });
});

describe('queryKeys', () => {
  it('separate data by location, tradition and language', () => {
    const a = queryKeys.panchang.today({
      location: { place: 'Austin, TX' },
      tradition: 'telugu',
      language: 'en',
    });
    const b = queryKeys.panchang.today({
      location: { place: 'Austin, TX' },
      tradition: 'tamil',
      language: 'en',
    });
    expect(a).not.toEqual(b);
  });

  it('separate good times by activity, date and Other description', () => {
    const base = { location: { place: 'Austin, TX' }, tradition: 'telugu', date: '2026-10-20' };
    const business = queryKeys.muhurta.goodTimes({ ...base, activity: 'business' });
    const travel = queryKeys.muhurta.goodTimes({ ...base, activity: 'travel' });
    const bakery = queryKeys.muhurta.goodTimes({ ...base, activity: 'other', otherText: 'Bakery' });
    const temple = queryKeys.muhurta.goodTimes({ ...base, activity: 'other', otherText: 'Temple visit' });
    expect(new Set([business, travel, bakery, temple].map((key) => JSON.stringify(key))).size).toBe(4);
    // The description only matters for Other, so it never splits the cache of a regular activity.
    expect(queryKeys.muhurta.goodTimes({ ...base, activity: 'business', otherText: 'x' })).toEqual(business);
  });
});
