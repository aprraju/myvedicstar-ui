import { describe, expect, it } from 'vitest';

import { publicPageMetadata } from '../../../../apps/web/src/shared/seo/page-metadata.ts';
import { renderLlmsTxt, renderRobots } from './sitemap.ts';

const site = 'https://www.myvedicstar.com';
const llms = renderLlmsTxt(site);

describe('llms.txt', () => {
  it('starts with the site name and a one-paragraph summary', () => {
    expect(llms.startsWith('# My Vedic Star\n')).toBe(true);
    expect(llms).toMatch(/^> .+$/m);
  });

  it('links every one of the ten public pages, absolutely', () => {
    for (const page of publicPageMetadata) {
      expect(llms).toContain(`](${new URL(page.path, site).href})`);
    }
    expect(llms.match(/^- \[[^\]]+\]\(https:\/\/[^)]+\):/gm)).toHaveLength(10);
  });

  it('says the Panchang is account-gated rather than missing', () => {
    expect(llms).toMatch(/require a free account/i);
    expect(llms).toMatch(/behind sign-in/i);
    expect(llms).not.toMatch(/calendar\b.*\bidx/i);
  });

  it('points at the sitemap and never at a gated URL as a public page', () => {
    expect(llms).toContain(`${site}/sitemap.xml`);
    expect(llms).not.toContain('](https://www.myvedicstar.com/calendar)');
    expect(llms).not.toContain('](https://www.myvedicstar.com/festivals)');
    expect(llms).not.toContain('](https://www.myvedicstar.com/good-time)');
  });
});

describe('robots.txt for AI crawlers', () => {
  it('does not block any AI crawler', () => {
    const robots = renderRobots(site);
    expect(robots).not.toMatch(/GPTBot|ClaudeBot|CCBot|Google-Extended|anthropic-ai|PerplexityBot/i);
    expect(robots).not.toMatch(/^Disallow:/m);
  });
});
