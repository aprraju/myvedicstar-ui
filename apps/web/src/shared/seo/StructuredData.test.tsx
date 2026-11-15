import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '../../test/render';
import { buildSiteStructuredData } from './StructuredData';

const site = 'https://www.myvedicstar.com';

function ldJson(): string | null {
  return document.getElementById('site-jsonld')?.textContent ?? null;
}

describe('site structured data', () => {
  it('declares Organization and WebSite with accurate fields', () => {
    const data = buildSiteStructuredData(site);
    expect(data['@context']).toBe('https://schema.org');
    const types = data['@graph'].map((node) => node['@type']);
    expect(types).toEqual(['Organization', 'WebSite']);

    const organization = data['@graph'][0]!;
    expect(organization.name).toBe('My Vedic Star');
    expect(organization.url).toBe('https://www.myvedicstar.com/');
    expect(organization.logo).toBe('https://www.myvedicstar.com/favicon.svg');

    const website = data['@graph'][1]!;
    expect(website.url).toBe('https://www.myvedicstar.com/');
    expect(website.publisher).toEqual({ '@id': 'https://www.myvedicstar.com/#organization' });
    expect(website.inLanguage).toBe('en');
  });

  it('invents no fields we do not hold', () => {
    const data = buildSiteStructuredData(site);
    const allowed = new Set([
      '@type',
      '@id',
      'name',
      'url',
      'logo',
      'description',
      'inLanguage',
      'publisher',
    ]);
    for (const node of data['@graph']) {
      for (const key of Object.keys(node)) expect(allowed.has(key), key).toBe(true);
    }
    expect(JSON.stringify(data)).not.toContain('telephone');
    expect(JSON.stringify(data)).not.toContain('ratingValue');
    expect(JSON.stringify(data)).not.toContain('SearchAction');
  });

  it('parses as valid JSON and serialises cleanly', () => {
    const text = JSON.stringify(buildSiteStructuredData(site));
    expect(() => JSON.parse(text)).not.toThrow();
    expect(JSON.parse(text)['@graph']).toHaveLength(2);
  });

  it('writes exactly one ld+json block on the homepage', async () => {
    renderRoute('/');
    await waitFor(() => expect(ldJson()).not.toBeNull());
    const blocks = document.querySelectorAll('script[type="application/ld+json"]');
    expect(blocks).toHaveLength(1);
    expect(() => JSON.parse(ldJson()!)).not.toThrow();
    expect(JSON.parse(ldJson()!)['@graph'][0]['@type']).toBe('Organization');
  });

  it('adds nothing on another public page', async () => {
    renderRoute('/about');
    await screen.findByRole('heading', { level: 1, name: 'About Us' });
    await waitFor(() => expect(document.querySelector('script[type="application/ld+json"]')).toBeNull());
  });
});
