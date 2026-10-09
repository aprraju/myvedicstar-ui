import type { TelemetrySink } from './clients';
import type { TelemetryProperties } from './privacy';

/**
 * Azure Monitor Application Insights sink. Sends the already-redacted items produced by `createObservability` to the
 * ingestion endpoint's track API in small batches, without the vendor SDK: no cookies, no automatic page/dependency
 * collection, no extra script origins, and nothing leaves the browser that the privacy guards did not see.
 */
export interface ApplicationInsightsSinkOptions {
  instrumentationKey: string;
  /** From the connection string, e.g. `https://eastus-8.in.applicationinsights.azure.com/`. */
  ingestionEndpoint: string;
  /** `cloud_RoleName` in Application Insights, e.g. `myvedicstar-web`. */
  roleName: string;
  /** Fraction of sessions that send telemetry (decided once per sink), 0–1. */
  sampleRate?: number;
  /** Items buffered before a send; a timer flushes smaller batches. */
  maxBatchSize?: number;
  flushIntervalMs?: number;
  fetchImpl?: typeof fetch;
  random?: () => number;
}

export interface ApplicationInsightsSink extends TelemetrySink {
  /** Sends buffered items now, e.g. when the page is being hidden. */
  flush(): void;
}

/** Items kept while the endpoint is unreachable; older ones are dropped first. */
const MAX_QUEUE = 200;
/** Browsers cap `keepalive` request bodies at 64 KiB in total. */
const KEEPALIVE_LIMIT = 60_000;

export function createApplicationInsightsSink(
  options: ApplicationInsightsSinkOptions,
): ApplicationInsightsSink {
  const {
    instrumentationKey,
    roleName,
    sampleRate = 1,
    maxBatchSize = 20,
    flushIntervalMs = 5_000,
    fetchImpl = (input, init) => fetch(input, init),
    random = Math.random,
  } = options;
  const url = `${options.ingestionEndpoint.replace(/\/+$/, '')}/v2/track`;
  const namePrefix = `Microsoft.ApplicationInsights.${instrumentationKey.replace(/-/g, '')}`;
  const sampled = random() < sampleRate;
  const sessionId = randomId();
  const queue: object[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    while (queue.length) {
      const body = JSON.stringify(queue.splice(0, maxBatchSize));
      fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: body.length < KEEPALIVE_LIMIT,
        credentials: 'omit',
      }).catch(() => {
        // Telemetry is best effort and must never surface to the user.
      });
    }
  };

  const envelope = (type: string, baseType: string, baseData: object, time = new Date()) => ({
    name: `${namePrefix}.${type}`,
    time: time.toISOString(),
    iKey: instrumentationKey,
    sampleRate: sampleRate * 100,
    tags: {
      'ai.cloud.role': roleName,
      'ai.session.id': sessionId,
      'ai.internal.sdkVersion': 'myvedicstar-sink:1',
    },
    data: { baseType, baseData: { ver: 2, ...baseData } },
  });

  return {
    flush,
    send(item) {
      if (!sampled) return;
      const properties = stringProperties(item.properties);
      switch (item.type) {
        case 'event':
          queue.push(envelope('Event', 'EventData', { name: item.name, properties }));
          break;
        case 'screen':
          queue.push(envelope('Pageview', 'PageviewData', { name: item.name, properties }));
          break;
        case 'metric':
          queue.push(
            envelope('Metric', 'MetricData', {
              metrics: [{ name: item.name, value: item.value, count: 1 }],
              properties,
            }),
          );
          break;
        case 'exception':
          queue.push(
            envelope('Exception', 'ExceptionData', {
              exceptions: [{ typeName: item.name, message: item.message, hasFullStack: false }],
              severityLevel: 3,
              properties,
            }),
          );
          break;
      }
      if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
      if (queue.length >= maxBatchSize) flush();
      else timer ??= setTimeout(flush, flushIntervalMs);
    },
  };
}

/** Application Insights custom dimensions are string → string. */
function stringProperties(properties: TelemetryProperties): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value !== null && value !== undefined) result[key] = String(value);
  }
  return result;
}

function randomId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
