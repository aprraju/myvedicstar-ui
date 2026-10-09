import type { TelemetryClient } from '@myvedicstar/analytics';

/**
 * Reports errors that escape React (event handlers, timers, rejected promises nobody awaited) to telemetry. Error
 * boundaries cover rendering; this covers the rest. Returns a function that removes the listeners.
 */
export function installGlobalErrorHandlers(telemetry: TelemetryClient, target: Window = window): () => void {
  const onError = (event: ErrorEvent) => {
    // Cross-origin script errors arrive as "Script error." with no details; nothing useful to report.
    if (!event.error && !event.message) return;
    telemetry.trackException(event.error ?? event.message, { source: 'window.error' });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    telemetry.trackException(event.reason, { source: 'unhandledrejection' });
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
