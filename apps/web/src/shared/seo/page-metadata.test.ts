import { describe, expect, it } from 'vitest';

import { appRoutes } from '../../app/router/router';
import { PUBLIC_PAGE_PATHS } from '../routing/served-routes';
import { pageMetadataFor, publicPageMetadata } from './page-metadata';

/** Paths the router registers that are reachable without signing in. */
function publicRouterPaths(): string[] {
  const root = appRoutes[0];
  const children = (root && 'children' in root ? root.children : undefined) ?? [];
  return children.map((route) => route.path).filter((path): path is string => Boolean(path) && path !== '*');
}

describe('page metadata', () => {
  it('covers exactly the ten public content pages', () => {
    expect(publicPageMetadata).toHaveLength(10);
    expect(publicPageMetadata.map((page) => page.path).sort()).toEqual([...PUBLIC_PAGE_PATHS].sort());
  });

  it('describes a page the router actually serves', () => {
    const served = new Set(publicRouterPaths());
    for (const page of publicPageMetadata) expect(served.has(page.path), page.path).toBe(true);
  });

  it('keeps titles and descriptions within search-result limits', () => {
    for (const page of publicPageMetadata) {
      expect(page.title.length, `${page.path} title`).toBeGreaterThan(10);
      expect(page.title.length, `${page.path} title`).toBeLessThanOrEqual(60);
      expect(page.description.length, `${page.path} description`).toBeGreaterThanOrEqual(70);
      expect(page.description.length, `${page.path} description`).toBeLessThanOrEqual(160);
    }
  });

  it('gives every page unique copy', () => {
    expect(new Set(publicPageMetadata.map((page) => page.title)).size).toBe(10);
    expect(new Set(publicPageMetadata.map((page) => page.description)).size).toBe(10);
  });

  it('resolves metadata by path and ignores trailing slashes', () => {
    expect(pageMetadataFor('/')?.path).toBe('/');
    expect(pageMetadataFor('/about/')?.path).toBe('/about');
    expect(pageMetadataFor('/calendar')).toBeUndefined();
    expect(pageMetadataFor('/this-does-not-exist')).toBeUndefined();
  });
});
