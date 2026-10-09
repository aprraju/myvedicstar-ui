/**
 * Privacy guards applied to every analytics and telemetry payload before it leaves the app.
 * Feature code should not need to remember these rules; the clients enforce them.
 */

const SENSITIVE_KEY =
  /(authorization|token|password|passwd|secret|cookie|session|credential|api[-_]?key|email|phone|birth|dob|latitude|longitude|^lat$|^lng$|^lon$|coordinates?)/i;
const BEARER = /bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export const REDACTED = '[redacted]';

export type TelemetryValue = string | number | boolean | null | undefined;
export type TelemetryProperties = Record<string, TelemetryValue>;

/** Removes sensitive keys and scrubs tokens/emails from string values. */
export function redactProperties(properties: TelemetryProperties | undefined): TelemetryProperties {
  const result: TelemetryProperties = {};
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (SENSITIVE_KEY.test(key)) {
      result[key] = REDACTED;
    } else {
      result[key] = typeof value === 'string' ? scrubText(value) : value;
    }
  }
  return result;
}

export function scrubText(text: string): string {
  return text.replace(BEARER, `Bearer ${REDACTED}`).replace(JWT, REDACTED).replace(EMAIL, REDACTED);
}

/**
 * Reduces a coordinate to about 11 km (1 decimal) for coarse location context, e.g. to understand regional usage.
 * Precise coordinates are never sent to analytics.
 */
export function coarsenCoordinate(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
