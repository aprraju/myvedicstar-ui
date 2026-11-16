/**
 * Server-side route knowledge for the deployed web content.
 *
 * Two consumers derive from this one table, so the edge and the SPA can never disagree about what exists:
 * - the deployment renders `404.html` from it (Azure Static Web Apps serves that file with HTTP 404 for any path the
 *   SPA router does not own — see static-web-app-config.ts),
 * - the tests assert every route the SPA registers is treated as known here.
 *
 * No visual values live in this module: the 404 document carries its styles in
 * `apps/web/src/styles/not-found.css`, which the build hashes into `/assets/`.
 */

/** Path for the pre-rendered not-found document served with HTTP 404. */
export const NOT_FOUND_FILE = '404.html';

/** The ten public content pages — the only pages search engines may index. */
export const PUBLIC_PAGE_PATHS = [
  '/',
  '/about',
  '/how-it-works',
  '/contact',
  '/help',
  '/privacy',
  '/terms',
  '/disclaimer',
  '/cookies',
  '/accessibility',
] as const;

/** Routes the SPA owns that are gated behind sign-in. They are known paths, never a 404. */
export const GATED_PATHS = ['/calendar', '/festivals', '/good-time', '/settings', '/profile'] as const;

/** Gated routes that also match a deeper path, e.g. `/calendar/2026-11-15`. */
export const GATED_PATH_PREFIXES = ['/calendar/'] as const;

/** Non-page routes the SPA owns: the identity callback and the signed-in alias for Home. */
export const APP_ONLY_PATHS = ['/auth/callback', '/dashboard', '/today', '/profiles'] as const;

const withoutTrailingSlash = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/**
 * True when the SPA router owns `pathname`. Everything else is a genuine 404.
 * Query strings and fragments are not part of the path and must be stripped by the caller.
 */
export function isAppPath(pathname: string): boolean {
  const path = withoutTrailingSlash(pathname);
  const known: readonly string[] = [...PUBLIC_PAGE_PATHS, ...GATED_PATHS, ...APP_ONLY_PATHS];
  if (known.includes(path)) return true;
  return GATED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix) && path.length > prefix.length);
}
