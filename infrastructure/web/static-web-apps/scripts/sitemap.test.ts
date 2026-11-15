import { describe, expect, it } from 'vitest';

import { GATED_PATHS } from '../../../../apps/web/src/shared/routing/served-routes.ts';
import { publicPageMetadata } from '../../../../apps/web/src/shared/seo/page-metadata.ts';
import { renderRobots, renderSitemap } from './sitemap.ts';

const site = 'https://www.myvedicstar.com';
const sitemap = renderSitemap(site);
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

describe('sitemap.xml', () => {
  it('is well-formed XML with the sitemaps.org namespace', () => {
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(sitemap.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('contains EXACTLY the ten public URLs — set equality', () => {
    const expected = publicPageMetadata.map((page) => new URL(page.path, site).href);
    expect(locs).toHaveLength(10);
    expect(new Set(locs)).toEqual(new Set(expected));
  });

  it('excludes every gated and non-public route', () => {
    for (const path of [...GATED_PATHS, '/auth/callback', '/dashboard', '/today', '/panchang']) {
      expect(locs, path).not.toContain(new URL(path, site).href);
    }
    expect(sitemap).not.toContain('/calendar');
    expect(sitemap).not.toContain('/festivals');
    expect(sitemap).not.toContain('/good-time');
  });

  it('uses the deployment origin it is given, without a double slash', () => {
    const staging = renderSitemap('https://staging.example.test/');
    expect(staging).toContain('<loc>https://staging.example.test/about</loc>');
    expect(staging).not.toContain('//about');
  });
});

describe('robots.txt', () => {
  it('allows crawling and names exactly one sitemap', () => {
    const robots = renderRobots(site);
    expect(robots).toContain('User-agent: *\nAllow: /');
    expect(robots.match(/^Sitemap: /gm)).toHaveLength(1);
    expect(robots).toContain(`Sitemap: ${site}/sitemap.xml`);
  });
});
