import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderRoute } from '../../test/render';
import { canonicalUrl, isIndexablePath } from './PageMetadata';

const productionSite = 'https://www.myvedicstar.com';

function canonical(): HTMLLinkElement | null {
  return document.head.querySelector('link[rel="canonical"]');
}

function meta(selector: string): string | null {
  return document.head.querySelector<HTMLMetaElement>(selector)?.getAttribute('content') ?? null;
}

describe('page metadata', () => {
  beforeEach(() => {
    document.head
      .querySelectorAll('link[rel="canonical"], meta[property^="og:"], meta[name="robots"]')
      .forEach((element) => element.remove());
  });

  it('builds the canonical URL from the site origin and the page path', () => {
    expect(canonicalUrl(productionSite, '/')).toBe('https://www.myvedicstar.com/');
    expect(canonicalUrl(productionSite, '/about')).toBe('https://www.myvedicstar.com/about');
    expect(canonicalUrl(productionSite, '/about/')).toBe('https://www.myvedicstar.com/about');
    expect(canonicalUrl(productionSite, '/calendar')).toBeUndefined();
  });

  it('never produces an apex or sign-in canonical', () => {
    const url = canonicalUrl(productionSite, '/terms');
    expect(url?.startsWith('https://www.myvedicstar.com/')).toBe(true);
    expect(url).not.toContain('//myvedicstar.com/');
    expect(url).not.toContain('/auth/');
  });

  it('indexes exactly the ten public pages', () => {
    expect(isIndexablePath('/')).toBe(true);
    expect(isIndexablePath('/how-it-works')).toBe(true);
    for (const path of ['/calendar', '/festivals', '/good-time', '/settings', '/profile', '/auth/callback']) {
      expect(isIndexablePath(path), path).toBe(false);
    }
  });

  it('adds exactly one self-referential canonical on a public page', async () => {
    renderRoute('/about');
    await screen.findByRole('heading', { level: 1, name: 'About Us' });
    await waitFor(() => expect(canonical()).not.toBeNull());
    const links = document.head.querySelectorAll('link[rel="canonical"]');
    expect(links).toHaveLength(1);
    expect(canonical()?.href).toBe(`${window.location.origin}/about`);
    expect(canonical()?.href).not.toContain('/auth/');
    expect(meta('meta[name="robots"]')).toBeNull();
    expect(meta('meta[property="og:url"]')).toBe(`${window.location.origin}/about`);
    expect(meta('meta[property="og:title"]')).toBeTruthy();
    expect(meta('meta[name="description"]')).toBeTruthy();
  });

  it('marks a gated route noindex and gives it no canonical', async () => {
    renderRoute('/calendar');
    await waitFor(() => expect(meta('meta[name="robots"]')).toBe('noindex, follow'));
    expect(canonical()).toBeNull();
    expect(meta('meta[property="og:url"]')).toBeNull();
  });
});
