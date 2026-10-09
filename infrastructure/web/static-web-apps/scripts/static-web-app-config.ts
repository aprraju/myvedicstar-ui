/**
 * Generates `staticwebapp.config.json` for one environment. Azure Static Web Apps reads it from the deployed content
 * root and applies routing, caching and response headers at the edge.
 *
 * The security headers come from the web app's single source of truth (apps/web/security/headers.ts); only CSP
 * `connect-src` varies per environment (API, identity authority and telemetry origins from the runtime config).
 * Reference: https://learn.microsoft.com/azure/static-web-apps/configuration
 */
import { type AppConfig, externalOrigins } from '@myvedicstar/config';

import { buildSecurityHeaders } from '../../../../apps/web/security/headers.ts';

/** Built-in Static Web Apps sign-in providers. The SPA signs in with Entra External ID itself, so these are closed. */
const BUILT_IN_AUTH_ROUTES = [
  '/.auth/login/aad',
  '/.auth/login/github',
  '/.auth/login/x',
  '/.auth/login/twitter',
];

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

export function buildStaticWebAppConfig(config: AppConfig): Record<string, unknown> {
  const headers = buildSecurityHeaders({ connectSrc: externalOrigins(config), hsts: true });
  // Only production is indexed by search engines; development and test sites must never appear in results.
  if (config.environment !== 'production') headers['X-Robots-Tag'] = 'noindex, nofollow';

  return {
    $schema: 'https://json.schemastore.org/staticwebapp.config.json',
    // Deep links (/calendar/2026-09-29) load the SPA with HTTP 200; the app renders its own 404 page. Files with an
    // extension and hashed assets are excluded, so a missing chunk is a real 404 rather than HTML served as JavaScript.
    navigationFallback: {
      rewrite: '/index.html',
      exclude: [
        '/assets/*',
        '/*.{js,mjs,css,json,map,svg,png,jpg,jpeg,gif,webp,ico,txt,xml,woff,woff2,webmanifest}',
      ],
    },
    routes: [
      ...BUILT_IN_AUTH_ROUTES.map((route) => ({ route, statusCode: 404 })),
      // Hidden source maps are stripped before upload; never serve one if it slips through.
      { route: '/assets/*.map', statusCode: 404 },
      // Content-hashed file names: cache for a year.
      { route: '/assets/*', headers: { 'Cache-Control': IMMUTABLE } },
      // Runtime config and every HTML response revalidate, so a release or config change is visible immediately.
      { route: '/config.json', headers: { 'Cache-Control': 'no-store' } },
      { route: '/favicon.svg', headers: { 'Cache-Control': 'public, max-age=86400' } },
      { route: '/robots.txt', headers: { 'Cache-Control': 'public, max-age=3600' } },
      { route: '/*', headers: { 'Cache-Control': REVALIDATE } },
    ],
    globalHeaders: headers,
    mimeTypes: {
      '.json': 'application/json',
      '.webmanifest': 'application/manifest+json',
    },
  };
}
