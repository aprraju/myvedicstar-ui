import { redactProperties, scrubText, type TelemetryProperties } from './privacy';

/** Product analytics (what users do). Feature code depends on this interface, never on a vendor SDK. */
export interface AnalyticsClient {
  trackEvent(name: string, properties?: TelemetryProperties): void;
  trackScreen(name: string, properties?: TelemetryProperties): void;
}

/** Operational telemetry (how the app behaves): errors, API performance. */
export interface TelemetryClient {
  trackException(error: unknown, properties?: TelemetryProperties): void;
  trackMetric(name: string, value: number, properties?: TelemetryProperties): void;
  /** Context attached to every subsequent item: app version, platform, device class, tradition… */
  setContext(context: TelemetryProperties): void;
}

/** Receives already-redacted items; implemented per provider (App Insights, OpenTelemetry, console…). */
export interface TelemetrySink {
  send(item: TelemetryItem): void;
}

export type TelemetryItem =
  | { type: 'event'; name: string; properties: TelemetryProperties }
  | { type: 'screen'; name: string; properties: TelemetryProperties }
  | { type: 'exception'; name: string; message: string; properties: TelemetryProperties }
  | { type: 'metric'; name: string; value: number; properties: TelemetryProperties };

export interface ObservabilityOptions {
  sinks: readonly TelemetrySink[];
  /** Analytics requires consent; operational telemetry is governed separately by the privacy policy. */
  hasAnalyticsConsent: () => boolean;
}

/**
 * Creates analytics and telemetry clients that redact every payload, respect consent and fan out to sinks.
 * A failing sink never breaks the app.
 */
export function createObservability({ sinks, hasAnalyticsConsent }: ObservabilityOptions): {
  analytics: AnalyticsClient;
  telemetry: TelemetryClient;
} {
  let context: TelemetryProperties = {};

  const emit = (item: TelemetryItem) => {
    for (const sink of sinks) {
      try {
        sink.send(item);
      } catch {
        // Observability must never affect the user experience.
      }
    }
  };

  const withContext = (properties?: TelemetryProperties) => redactProperties({ ...context, ...properties });

  return {
    analytics: {
      trackEvent: (name, properties) => {
        if (hasAnalyticsConsent()) emit({ type: 'event', name, properties: withContext(properties) });
      },
      trackScreen: (name, properties) => {
        if (hasAnalyticsConsent()) emit({ type: 'screen', name, properties: withContext(properties) });
      },
    },
    telemetry: {
      trackException: (error, properties) => {
        const { name, message } = describeError(error);
        emit({ type: 'exception', name, message, properties: withContext(properties) });
      },
      trackMetric: (name, value, properties) =>
        emit({ type: 'metric', name, value, properties: withContext(properties) }),
      setContext: (next) => {
        context = { ...context, ...redactProperties(next) };
      },
    },
  };
}

/** Error name and a scrubbed message; stack traces are left to the provider's own capture, not copied into props. */
function describeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: scrubText(error.message).slice(0, 500) };
  return { name: 'NonError', message: scrubText(String(error)).slice(0, 500) };
}

/** Development sink: logs to the console. Never enable in production builds. */
export const consoleSink: TelemetrySink = {
  send: (item) => console.warn(`[telemetry:${item.type}]`, item.name, item),
};

/** In-memory sink for tests. */
export function createMemorySink(): TelemetrySink & { items: TelemetryItem[] } {
  const items: TelemetryItem[] = [];
  return { items, send: (item) => items.push(item) };
}
