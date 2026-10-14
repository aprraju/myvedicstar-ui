import { type ApiClient, ApiError, queryKeys, retryDelayMs, shouldRetryQuery } from '@myvedicstar/api-client';
import { msUntilNextLocalDay } from '@myvedicstar/date-time';
import { fixtures } from '@myvedicstar/testing';
import { dehydrate, focusManager, onlineManager, QueryObserver } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCachingClient, removeUserCache } from './client';
import { scopedKey } from './keys';
import { subscribeLocalDate } from './local-date';
import { cachedPanchangRange, panchangMonthOptions, seedPanchangDays } from './panchang';
import { createCachePersister, persistenceBuster, shouldPersistQuery } from './persistence';
import { cachePolicies, defaultCacheSettings } from './policies';

const params = {
  location: { latitude: 30.27, longitude: -97.74, timeZone: 'America/Chicago' },
  tradition: 'telugu',
  language: 'en',
};
const clients: ReturnType<typeof createCachingClient>[] = [];
const client = () => {
  const value = createCachingClient();
  clients.push(value);
  return value;
};
afterEach(() => {
  clients.forEach((value) => value.clear());
  clients.length = 0;
  vi.useRealTimers();
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
});

describe('shared web and mobile cache', () => {
  it('refreshes a fresh legacy calendar response once and then reuses backend short names', async () => {
    const cache = client();
    const legacy = structuredClone(fixtures.panchang.austinTelugu);
    const updated = structuredClone(legacy);
    for (const tithi of updated.days[0]!.tithis) tithi.shortName = 'Chatur';
    const month = vi.fn(async () => updated);
    const api = { panchang: { month } } as unknown as ApiClient;
    const options = panchangMonthOptions({ api, params, userId: 'u1' }, cache, 2026, 9);
    cache.setQueryData(options.queryKey, legacy);
    const observer = new QueryObserver(cache, options);
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data?.days[0]!.tithis[0]!.shortName).toBe('Chatur'),
    );
    unsubscribe();
    const nextObserver = new QueryObserver(cache, options);
    const unsubscribeNext = nextObserver.subscribe(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(month).toHaveBeenCalledTimes(1);
    unsubscribeNext();
  });
  it('fetches once and avoids 9 repeated API calls while data is fresh', async () => {
    const cache = client();
    const fetch = vi.fn(async () => ({ result: true }));
    const options = {
      queryKey: scopedKey(
        queryKeys.muhurta.goodTimes({ ...params, activity: 'travel', date: '2026-10-09' }),
        'u1',
      ),
      queryFn: fetch,
      ...cachePolicies.goodTime,
    };
    for (let i = 0; i < 10; i++) await cache.fetchQuery(options);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent requests', async () => {
    const cache = client();
    const fetch = vi.fn(async () => 'value');
    const options = { queryKey: ['deduplicated'], queryFn: fetch };
    await Promise.all([cache.fetchQuery(options), cache.fetchQuery(options)]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('isolates dates, coordinates, zones, activities, birth stars, users and versions', () => {
    const request = { ...params, date: '2026-10-09', activity: 'travel' };
    const key = (value = request, user = 'u1', settings = defaultCacheSettings) =>
      scopedKey(queryKeys.muhurta.goodTimes(value), user, settings);
    const base = key();
    for (const value of [
      { ...request, date: '2026-10-10' },
      { ...request, location: { ...params.location, latitude: 17.39 } },
      { ...request, location: { ...params.location, timeZone: 'Asia/Kolkata' } },
      { ...request, activity: 'business' },
      { ...request, tradition: 'tamil' },
      { ...request, language: 'te' },
      { ...request, nakshatra: 'Rohini' },
    ])
      expect(key(value)).not.toEqual(base);
    expect(key(request, 'u2')).not.toEqual(base);
    expect(key(request, 'u1', { ...defaultCacheSettings, rulesVersion: '2' })).not.toEqual(base);
    expect(key(request, 'u1', { ...defaultCacheSettings, schemaVersion: '2' })).not.toEqual(base);
    expect(key(request, 'u1', { ...defaultCacheSettings, calculationVersion: '2' })).not.toEqual(base);
    expect(queryKeys.muhurta.goodTimes({ ...request, nakshatra: '' })).toEqual(
      queryKeys.muhurta.goodTimes(request),
    );
  });

  it('seeds calendar and Today days for immediate date navigation without replacing newer data', async () => {
    const cache = client();
    const response = fixtures.panchang.austinTelugu;
    seedPanchangDays(cache, response, params, 'u1');
    const date = response.days[0]!.date;
    const key = scopedKey(queryKeys.panchang.date(date, params), 'u1');
    const fetch = vi.fn(async () => response);
    const cached = await cache.fetchQuery({ queryKey: key, queryFn: fetch, ...cachePolicies.panchang });
    expect(cached.days).toEqual([response.days[0]]);
    expect(fetch).not.toHaveBeenCalled();
    seedPanchangDays(
      cache,
      { ...response, calculationVersion: 'older' },
      params,
      'u1',
      defaultCacheSettings,
      1,
    );
    expect(cache.getQueryData(key)).toEqual(cached);
    expect(cache.getQueryData(scopedKey(queryKeys.panchang.date(date, params), 'u2'))).toBeUndefined();
  });

  it('changes Today keys at local midnight and schedules DST-safe midnight checks', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T00:00:00-05:00'));
    expect(msUntilNextLocalDay('America/Chicago')).toBe(25 * 60 * 60_000);
    const notify = vi.fn();
    const stop = subscribeLocalDate('America/Chicago', notify);
    await vi.advanceTimersByTimeAsync(25 * 60 * 60_000 + 1);
    expect(notify).toHaveBeenCalledTimes(1);
    stop();
    expect(queryKeys.panchang.today(params, '2026-11-01')).not.toEqual(
      queryKeys.panchang.today(params, '2026-11-02'),
    );
    vi.setSystemTime(new Date('2026-03-08T00:00:00-06:00'));
    expect(msUntilNextLocalDay('America/Chicago')).toBe(23 * 60 * 60_000);
  });

  it('reuses fully overlapping day ranges but never substitutes missing days or a different tradition', () => {
    const cache = client();
    const response = fixtures.panchang.austinTelugu;
    const day = response.days[0]!;
    seedPanchangDays(cache, { ...response, days: [day, { ...day, date: '2026-09-30' }] }, params, 'u1');
    expect(
      cachedPanchangRange(cache, params, 'u1', defaultCacheSettings, '2026-09-29', 2)?.data.days,
    ).toHaveLength(2);
    expect(cachedPanchangRange(cache, params, 'u1', defaultCacheSettings, '2026-09-29', 3)).toBeUndefined();
    expect(
      cachedPanchangRange(
        cache,
        { ...params, tradition: 'tamil' },
        'u1',
        defaultCacheSettings,
        '2026-09-29',
        2,
      ),
    ).toBeUndefined();
  });

  it('checks the date on resume and reconnect', () => {
    vi.useFakeTimers();
    const notify = vi.fn();
    const stop = subscribeLocalDate('America/Chicago', notify);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    expect(notify).toHaveBeenCalledTimes(2);
    stop();
  });

  it('removes old account data while retaining public and other account entries', async () => {
    const cache = client();
    const publicKey = scopedKey(['panchang', 'today'], null);
    const oldKey = scopedKey(['muhurta', 'good-times'], 'old');
    const newKey = scopedKey(['muhurta', 'good-times'], 'new');
    for (const key of [publicKey, oldKey, newKey]) cache.setQueryData(key, 'data');
    cache.setQueryData(queryKeys.auth.userInfo('old'), 'profile');
    await removeUserCache(cache, 'old');
    expect(cache.getQueryData(oldKey)).toBeUndefined();
    expect(cache.getQueryData(queryKeys.auth.userInfo('old'))).toBeUndefined();
    expect(cache.getQueryData(publicKey)).toBe('data');
    expect(cache.getQueryData(newKey)).toBe('data');
  });

  it('cancels a superseded request without overwriting another selection', async () => {
    const cache = client();
    const key = ['old-selection'];
    let signal: AbortSignal | undefined;
    const pending = cache
      .fetchQuery({
        queryKey: key,
        queryFn: (context) => {
          signal = context.signal;
          return new Promise<string>(() => undefined);
        },
      })
      .catch(() => undefined);
    await cache.cancelQueries({ queryKey: key });
    await pending;
    expect(signal?.aborted).toBe(true);
    cache.setQueryData(['new-selection'], 'new');
    expect(cache.getQueryData(key)).toBeUndefined();
    expect(cache.getQueryData(['new-selection'])).toBe('new');
  });

  it('returns cached data offline without starting a request', async () => {
    const cache = client();
    cache.setQueryData(['offline'], 'available');
    onlineManager.setOnline(false);
    const fetch = vi.fn(async () => 'network');
    expect(await cache.fetchQuery({ queryKey: ['offline'], queryFn: fetch, staleTime: 60_000 })).toBe(
      'available',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('respects rate limits and never retries unauthorized or invalid requests', () => {
    for (const [status, kind] of [
      [400, 'validation'],
      [401, 'authentication'],
      [403, 'authorization'],
      [404, 'notFound'],
      [429, 'rateLimit'],
    ] as const) {
      expect(shouldRetryQuery(0, new ApiError({ status, kind }))).toBe(false);
    }
    const error = new ApiError({ kind: 'rateLimit', status: 429, retryAfterMs: 120_000 });
    expect(retryDelayMs(0, error)).toBe(120_000);
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(false);
  });

  it('can disable fresh-cache reuse', async () => {
    const cache = createCachingClient({ ...defaultCacheSettings, enabled: false });
    clients.push(cache);
    const fetch = vi.fn(async () => 'data');
    await cache.fetchQuery({ queryKey: ['uncached'], queryFn: fetch });
    await cache.fetchQuery({ queryKey: ['uncached'], queryFn: fetch });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('approved persistence', () => {
  const setup = () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn(async (key: string) => values.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        values.delete(key);
      }),
    };
    return { values, storage, persister: createCachePersister(storage, defaultCacheSettings) };
  };

  it('saves and restores only anonymous Today, never profiles or private calculations', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-29T10:00:00-05:00'));
    const cache = client();
    const publicKey = scopedKey(queryKeys.panchang.today(params, '2026-09-29'), null);
    cache.setQueryData(publicKey, fixtures.panchang.austinTelugu);
    cache.setQueryData(
      scopedKey(queryKeys.panchang.today(params, '2026-09-29'), 'u1'),
      fixtures.panchang.austinTelugu,
    );
    cache.setQueryData(queryKeys.auth.userInfo('u1'), { token: 'must-not-persist' });
    const { persister } = setup();
    await persistQueryClientSave({
      queryClient: cache,
      persister,
      buster: persistenceBuster(defaultCacheSettings),
      dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery, shouldDehydrateMutation: () => false },
    });
    await vi.advanceTimersByTimeAsync(1100);
    const restored = client();
    await persistQueryClientRestore({
      queryClient: restored,
      persister,
      buster: persistenceBuster(defaultCacheSettings),
      maxAge: cachePolicies.persistence.maxAge,
    });
    expect(restored.getQueryCache().getAll()).toHaveLength(1);
    expect(restored.getQueryData(publicKey)).toEqual(fixtures.panchang.austinTelugu);
  });

  it('discards expired entries and yesterday data even inside the storage max age', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T01:00:00-05:00'));
    const { values, storage, persister } = setup();
    const cache = client();
    cache.setQueryData(
      scopedKey(queryKeys.panchang.today(params, '2026-09-29'), null),
      fixtures.panchang.austinTelugu,
    );
    const stored = {
      timestamp: Date.now(),
      buster: persistenceBuster(defaultCacheSettings),
      clientState: dehydrate(cache),
    };
    values.set('myvedicstar-public-query-cache', JSON.stringify(stored));
    expect((await persister.restoreClient())?.clientState.queries).toEqual([]);
    values.set(
      'myvedicstar-public-query-cache',
      JSON.stringify({ ...stored, timestamp: Date.now() - cachePolicies.persistence.maxAge - 1 }),
    );
    expect(await persister.restoreClient()).toBeUndefined();
    expect(storage.removeItem).toHaveBeenCalled();
  });

  it('falls back safely on invalid storage or storage failure', async () => {
    const { values, persister } = setup();
    values.set('myvedicstar-public-query-cache', '{invalid');
    expect(await persister.restoreClient()).toBeUndefined();
    const report = vi.fn();
    const broken = createCachePersister(
      {
        getItem: async () => {
          throw new Error('blocked');
        },
        setItem: async () => undefined,
        removeItem: async () => undefined,
      },
      defaultCacheSettings,
      report,
    );
    expect(await broken.restoreClient()).toBeUndefined();
    expect(report).toHaveBeenCalledWith({ event: 'storage-error' });
  });
});
