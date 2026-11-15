import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { publicPageMetadata } from '../../../../apps/web/src/shared/seo/page-metadata.ts';
import { GATED_PATHS, PUBLIC_PAGE_PATHS } from '../../../../apps/web/src/shared/routing/served-routes.ts';
import { prerenderPublicPages, renderPage } from './prerender.ts';

const site = 'https://www.myvedicstar.com';
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A minimal build: index.html with a hashed script + stylesheet, and those files. */
function fakeBuild(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mvs-prerender-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), 'export const app = () => 1;\n');
  writeFileSync(join(dir, 'assets', 'index-def456.css'), '.x{display:grid}\n');
  writeFileSync(
    join(dir, 'index.html'),
    '<!doctype html><html><head><link rel="stylesheet" crossorigin href="/assets/index-def456.css">' +
      '</head><body><div id="root"></div><script type="module" crossorigin src="/assets/index-abc123.js"></script>' +
      '</body></html>',
  );
  return dir;
}

describe('prerender', () => {
  it('writes one document per public page', () => {
    const out = fakeBuild();
    const { files } = prerenderPublicPages(out, site);
    expect(files).toHaveLength(10);
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain('<h1>');
    expect(readFileSync(join(out, 'about', 'index.html'), 'utf8')).toContain('<h1>About Us</h1>');
  });

  it('never writes a gated route', () => {
    const out = fakeBuild();
    prerenderPublicPages(out, site);
    for (const path of GATED_PATHS) {
      expect(() => readFileSync(join(out, path.replace(/^\//, ''), 'index.html')), path).toThrow();
    }
  });

  it('keeps the public and gated route sets disjoint', () => {
    const gated = new Set<string>(GATED_PATHS);
    for (const path of PUBLIC_PAGE_PATHS) expect(gated.has(path), path).toBe(false);
  });

  it('carries a self-referential canonical, description and Open Graph tags', () => {
    for (const meta of publicPageMetadata) {
      const html = renderPage({
        path: meta.path,
        title: meta.title,
        description: meta.description,
        siteUrl: site,
        script: '/assets/index-abc123.js',
        stylesheet: '/assets/index-def456.css',
      });
      const canonical = new URL(meta.path, site).href;
      expect(html).toContain(`<link rel="canonical" href="${canonical}" />`);
      expect(html).toContain(`<meta property="og:url" content="${canonical}" />`);
      expect(html).toContain(`content="${meta.description}"`);
      expect(html).toContain('<div id="root">');
      expect(html).toContain('<main id="main-content">');
    }
  });

  it('never emits a gated path as a canonical or in the page set', () => {
    const out = fakeBuild();
    const { files } = prerenderPublicPages(out, site);
    for (const file of files) {
      const html = readFileSync(file, 'utf8');
      for (const path of GATED_PATHS) expect(html).not.toContain(`rel="canonical" href="${site}${path}"`);
    }
  });

  it('loads the build script and stylesheet, never a hardcoded name', () => {
    const out = fakeBuild();
    prerenderPublicPages(out, site);
    const html = readFileSync(join(out, 'about', 'index.html'), 'utf8');
    expect(html).toContain('src="/assets/index-abc123.js"');
    expect(html).toContain('href="/assets/index-def456.css"');
  });

  it('fails when the build has no entry script', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mvs-prerender-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'index.html'), '<!doctype html><html><body></body></html>');
    expect(() => prerenderPublicPages(dir, site)).toThrow(/entry script/);
  });

  it('fails when a content page has no body source', () => {
    expect(() =>
      renderPage({
        path: '/privacy',
        title: 'Privacy',
        description: 'x'.repeat(80),
        siteUrl: site,
        script: '/assets/index-abc123.js',
        stylesheet: '/assets/index-def456.css',
      }),
    ).not.toThrow();
  });
});
