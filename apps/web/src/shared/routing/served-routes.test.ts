import { describe, expect, it } from 'vitest';

import { appRoutes } from '../../app/router/router';
import { GATED_PATH_PREFIXES, GATED_PATHS, isAppPath, PUBLIC_PAGE_PATHS } from './served-routes';

/** Every path the router registers, with `:param` segments replaced by a concrete value. */
function registeredPaths(): string[] {
  const root = appRoutes[0];
  const children = (root && 'children' in root ? root.children : undefined) ?? [];
  return children
    .map((route) => route.path)
    .filter((path): path is string => Boolean(path) && path !== '*')
    .map((path) => path.replace(':date', '2026-11-15').replace(':id', '1'));
}

describe('served routes', () => {
  it('treats every public page as an app path', () => {
    for (const path of PUBLIC_PAGE_PATHS) expect(isAppPath(path), path).toBe(true);
  });

  it('treats every registered router path as an app path', () => {
    for (const path of registeredPaths()) expect(isAppPath(path), path).toBe(true);
  });

  it('knows the gated routes and their deeper paths', () => {
    for (const path of GATED_PATHS) expect(isAppPath(path), path).toBe(true);
    for (const prefix of GATED_PATH_PREFIXES) expect(isAppPath(`${prefix}2026-11-15`), prefix).toBe(true);
  });

  it('rejects unknown paths so the edge can answer 404', () => {
    for (const path of [
      '/this-does-not-exist-xyz123',
      '/panchang',
      '/calendarx',
      '/about/extra',
      '/festivals//1/2/3',
    ]) {
      expect(isAppPath(path), path).toBe(false);
    }
  });

  it('ignores a trailing slash but nothing else', () => {
    expect(isAppPath('/about/')).toBe(true);
    expect(isAppPath('/about//')).toBe(true);
    expect(isAppPath('/')).toBe(true);
    expect(isAppPath('')).toBe(false);
  });

  it('keeps exactly the ten public pages', () => {
    expect(PUBLIC_PAGE_PATHS).toHaveLength(10);
  });
});
