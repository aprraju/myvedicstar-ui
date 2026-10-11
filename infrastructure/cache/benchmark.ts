import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { queryKeys } from '@myvedicstar/api-client';
import { cachePolicies, createCachingClient, scopedKey } from '@myvedicstar/query-cache';
import { fixtures } from '@myvedicstar/testing';
import { QueryClient } from '@tanstack/react-query';

/** Mocked deterministic calculation responses. This measures query resolution, not browser paint or Azure latency. */
const params = { location: { latitude: 30.27, longitude: -97.74, timeZone: 'America/Chicago' }, tradition: 'telugu', language: 'en', activity: 'general', date: '2026-10-20' };
const key = scopedKey(queryKeys.muhurta.goodTimes(params), 'benchmark-user');
const clock = Date.now;
const baseTime = clock();
let virtualTime = baseTime;

async function run(name: string, staleTime: number, spaced: boolean) {
  const client = name === 'shared' ? createCachingClient() : new QueryClient();
  let requests = 0;
  const durations: number[] = [];
  try {
    for (let visit = 0; visit < 10; visit++) {
      virtualTime = baseTime + (spaced ? visit * 6 * 60_000 : 0);
      const started = performance.now();
      await client.fetchQuery({
        queryKey: key,
        staleTime,
        queryFn: async () => {
          requests++;
          await new Promise<void>((resolve) => setTimeout(resolve, 20));
          return fixtures.muhurta.goodTimes.austinGeneral;
        },
      });
      durations.push(performance.now() - started);
    }
    return { policy: name, visits: 10, apiRequests: requests, firstQueryMs: Number(durations[0]?.toFixed(3)), meanRepeatQueryMs: Number((durations.slice(1).reduce((sum, duration) => sum + duration, 0) / 9).toFixed(3)) };
  } finally { client.clear(); }
}

Date.now = () => virtualTime;
try {
  const result = {
    methodology: 'Mocked transport with 20 ms simulated latency; ten identical Good Time visits. Query resolution only, no device rendering or live Azure measurements.',
    immediateNavigation: [await run('existing-5-minute', 5 * 60_000, false), await run('shared', cachePolicies.goodTime.staleTime, false)],
    navigationEverySixMinutes: [await run('existing-5-minute', 5 * 60_000, true), await run('shared', cachePolicies.goodTime.staleTime, true)],
  };
  await writeFile(new URL('../../docs/performance/query-cache-benchmark.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
} finally { Date.now = clock; }
