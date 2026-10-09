/**
 * Single source of truth for the web app's security headers. Used by:
 * - `vite preview` (so E2E tests run under the production policy and fail on CSP violations),
 * - `npm run security:headers` (prints the headers for the CDN / Front Door rule set at deploy time).
 * See docs/security/content-security-policy.md.
 */

export interface CspOptions {
  /** Origins the SPA calls: the backend API origin, plus the identity authority and telemetry endpoint when enabled. */
  connectSrc: readonly string[];
  /**
   * Extra script and style sources. Production: none. The development server adds only a per-start nonce, because
   * Vite injects the React Fast Refresh preamble and CSS as inline elements in development (never 'unsafe-inline').
   */
  scriptSrc?: readonly string[];
  styleSrc?: readonly string[];
  /** Extra image origins (none today; map tiles would add one here). */
  imgSrc?: readonly string[];
  /** Identity provider origins that may be framed for silent token renewal (none: renewal uses refresh tokens). */
  frameSrc?: readonly string[];
  /** Where browsers send CSP violation reports (Reporting API endpoint name defined in Reporting-Endpoints). */
  reportTo?: string;
  /** Default true. Disabled only for local http preview, where it would rewrite http://localhost API calls. */
  upgradeInsecureRequests?: boolean;
}

export function buildContentSecurityPolicy(options: CspOptions): string {
  const directives: Record<string, readonly string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", ...(options.scriptSrc ?? [])],
    'style-src': ["'self'", ...(options.styleSrc ?? [])],
    'img-src': ["'self'", 'data:', ...(options.imgSrc ?? [])],
    'font-src': ["'self'"],
    'connect-src': ["'self'", ...options.connectSrc],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'"],
    'frame-src': options.frameSrc?.length ? options.frameSrc : ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  if (options.upgradeInsecureRequests !== false) directives['upgrade-insecure-requests'] = [];
  if (options.reportTo) directives['report-to'] = [options.reportTo];

  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(' '))
    .join('; ');
}

export function buildSecurityHeaders(options: CspOptions & { hsts?: boolean }): Record<string, string> {
  return {
    'Content-Security-Policy': buildContentSecurityPolicy(options),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Geolocation is used by the location feature (self only); everything else is off.
    'Permissions-Policy':
      'geolocation=(self), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...(options.hsts === false
      ? {}
      : { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' }),
  };
}

/** Origin of a URL, e.g. `https://api.example.com/v1` → `https://api.example.com`. */
export function originOf(url: string): string {
  return new URL(url).origin;
}
