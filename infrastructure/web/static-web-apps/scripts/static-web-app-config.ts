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
import {
  APP_ONLY_PATHS,
  GATED_PATH_PREFIXES,
  GATED_PATHS,
  PUBLIC_PAGE_PATHS,
} from '../../../../apps/web/src/shared/routing/served-routes.ts';

/** Built-in Static Web Apps sign-in providers. The SPA signs in with Entra External ID itself, so these are closed. */
const BUILT_IN_AUTH_ROUTES = [
  '/.auth/login/aad',
  '/.auth/login/github',
  '/.auth/login/x',
  '/.auth/login/twitter',
];

const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * Paths the SPA router owns. Everything else bypasses `navigationFallback`, so Azure Static Web Apps answers with the
 * pre-rendered `404.html` document and HTTP 404 instead of the app shell at 200.
 */
const SPA_ROUTES: string[] = [
  ...PUBLIC_PAGE_PATHS,
  ...GATED_PATHS,
  ...GATED_PATH_PREFIXES.map((prefix) => `${prefix}*`),
  ...APP_ONLY_PATHS,
];
const REVALIDATE = 'no-cache';

export function buildStaticWebAppConfig(config: AppConfig): Record<string, unknown> {
  const headers = buildSecurityHeaders({ connectSrc: externalOrigins(config), hsts: true });
  // Only production is indexed by search engines; development and test sites must never appear in results.
  if (config.environment !== 'production') headers['X-Robots-Tag'] = 'noindex, nofollow';

  return {
    $schema: 'https://json.schemastore.org/staticwebapp.config.json',
    // Deep links on routes the SPA owns (/calendar/2026-09-29) load the SPA with HTTP 200. Only those routes are
    // rewritten: any other path is a real 404 served from 404.html (see responseOverrides below). Files with an
    // extension and hashed assets are excluded, so a missing chunk is a real 404 rather than HTML served as JavaScript.
    navigationFallback: {
      rewrite: '/index.html',
      exclude: [
        '/assets/*',
        '/*.{js,mjs,css,json,map,svg,png,jpg,jpeg,gif,webp,ico,txt,xml,woff,woff2,webmanifest}',
      ],
    },
    responseOverrides: {
      // A request that fell through to 404.html was not rewritten by navigationFallback: it is an unknown path.
      // Return HTTP 404 (the file itself is served) so crawlers see a real missing page instead of a soft 404.
      '404': {
        rewrite: '/404.html',
        statusCode: 404,
      },
    },
    routes: [
      // Known SPA routes are rewritten to the shell; this comes first so no other rule can shadow it.
      ...SPA_ROUTES.map((route) => ({
        route,
        rewrite: '/index.html',
        headers: { 'Cache-Control': REVALIDATE },
      })),
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
      // Served because it is a real file (rendered per deployment), and crawlers expect application/xml.
      '.xml': 'application/xml',
      '.json': 'application/json',
      '.webmanifest': 'application/manifest+json',
    },
  };
}
