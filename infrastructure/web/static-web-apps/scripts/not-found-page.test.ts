import { describe, expect, it } from 'vitest';

import { renderNotFoundPage } from './not-found-page.ts';

const html = renderNotFoundPage({ stylesheetHref: '/assets/not-found-D7IhZKAA.css' });

describe('404.html', () => {
  it('is a real document with the not-found message', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<h1 id="not-found-title" class="not-found-title">Page not found</h1>');
    expect(html).toContain('We couldn&#x27;t'.replace('&#x27;', "'"));
  });

  it('loads no JavaScript and only a hashed stylesheet', () => {
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).toContain('<link rel="stylesheet" href="/assets/not-found-D7IhZKAA.css" />');
  });

  it('is marked noindex and links home', () => {
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).toContain('<a class="not-found-action" href="/">');
  });

  it('escapes the stylesheet href', () => {
    const escaped = renderNotFoundPage({ stylesheetHref: '/assets/a.css"><script>alert(1)</script>' });
    expect(escaped).not.toContain('"><script>');
    expect(escaped).toContain('&quot;&gt;&lt;script&gt;');
  });
});
