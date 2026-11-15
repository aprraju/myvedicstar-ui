/**
 * Renders `/sitemap.xml` per deployment, from the same registry the SPA uses for canonical URLs.
 *
 * Exactly the ten public content pages are listed: gated routes, the sign-in callback and the `/dashboard` alias never
 * appear, because they are not part of the indexable site. Absolute URLs use the environment's public origin, so the
 * development and test deployments describe themselves rather than production.
 */
import { publicPageMetadata } from '../../../../apps/web/src/shared/seo/page-metadata.ts';

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderSitemap(siteUrl: string): string {
  const origin = siteUrl.replace(/\/+$/, '');
  const urls = publicPageMetadata
    .map((page) => `  <url><loc>${escapeXml(new URL(page.path, origin).href)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/**
 * `llms.txt`: a plain-text summary of the site and its public pages for AI crawlers and assistants.
 *
 * Scope is stated honestly: the ten public pages are here, and today's Panchang — the product itself — is behind an
 * account, so a reader is told it is gated rather than left to conclude the content does not exist (SEO-8 AC4).
 */
export function renderLlmsTxt(siteUrl: string): string {
  const origin = siteUrl.replace(/\/+$/, '');
  const pages = publicPageMetadata
    .map((page) => `- [${page.title}](${new URL(page.path, origin).href}): ${page.description}`)
    .join('\n');
  return `# My Vedic Star

> My Vedic Star publishes a clear daily Hindu Panchang (Tithi, Nakshatra, Yoga, Karana, Vara, sunrise and sunset,
> Rahu Kalam, Yamagandam, Gulika, Varjyam and Durmuhurtam) calculated for the reader's own location and time zone.
> This file describes the public, indexable part of the site.

## Public pages

${pages}

## Not public

- Today's Panchang, the calendar, festivals and "Find a Good Time" require a free account. They are intentionally
  behind sign-in and are not indexed, so their absence from this list does not mean the content is missing.
- Panchang calculations are astronomical and location-specific; the day rating is a summary of the five Panchanga
  limbs, not personal astrological advice.

## Sitemap

- [Sitemap](${origin}/sitemap.xml)
`;
}

/** `robots.txt` for an environment: the allow-all policy plus one Sitemap line pointing at this deployment. */
export function renderRobots(siteUrl: string): string {
  const origin = siteUrl.replace(/\/+$/, '');
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}
