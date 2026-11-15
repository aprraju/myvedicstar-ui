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

/** `robots.txt` for an environment: the allow-all policy plus one Sitemap line pointing at this deployment. */
export function renderRobots(siteUrl: string): string {
  const origin = siteUrl.replace(/\/+$/, '');
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}
