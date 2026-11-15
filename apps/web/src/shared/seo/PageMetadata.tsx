/**
 * Keeps the document's search metadata in step with the current route: the canonical link, the description and the
 * Open Graph tags. One component, one place, so the values can never drift between pages.
 *
 * Rules that matter for indexing:
 * - The canonical URL is built from the configured site origin plus the page's own path. It is never an apex URL
 *   (the origin comes from runtime configuration, which is the www site) and never a sign-in URL.
 * - Public content pages come from `pageMetadata` and carry a self-referential canonical.
 * - Routes the SPA owns but that are not public content (sign-in callback, the signed-in Home alias, gated routes)
 *   carry `noindex` instead of a canonical, so they never compete with the ten public pages.
 * - Anything else is left to the edge, which serves 404.html with noindex (SEO-2).
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { isAppPath } from '../routing/served-routes';
import { useServices } from '../services/ServicesContext';
import { pageMetadataFor } from './page-metadata';
import { siteOrigin } from './site-origin';

const CANONICAL = 'link[rel="canonical"]';
const ROBOTS = 'meta[name="robots"]';
const OG = ['og:title', 'og:description', 'og:url', 'og:type', 'og:site_name'] as const;

function setMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.setAttribute('content', content);
}

function remove(selector: string): void {
  for (const element of document.head.querySelectorAll(selector)) element.remove();
}

/** Absolute page URL for the ten public pages, or `undefined` for every other path. */
export function canonicalUrl(siteUrl: string, pathname: string): string | undefined {
  const page = pageMetadataFor(pathname);
  if (!page) return undefined;
  return new URL(page.path, siteUrl).href;
}

/** Whether a path is public content that search engines may index. */
export function isIndexablePath(pathname: string): boolean {
  return pageMetadataFor(pathname) !== undefined;
}

export function PageMetadata() {
  const { pathname } = useLocation();
  const { config } = useServices();
  const origin = siteOrigin(config);

  useEffect(() => {
    const page = pageMetadataFor(pathname);
    if (!page) {
      // Not public content. Owned by the SPA (gated route, callback): keep it out of the index, but it is not a
      // missing page either, so the edge's 404 handling does not apply.
      remove(CANONICAL);
      for (const key of OG) remove(`meta[property="${key}"]`);
      setMeta('name', 'robots', isAppPath(pathname) ? 'noindex, follow' : 'noindex');
      setMeta('name', 'description', '');
      return;
    }

    const url = canonicalUrl(origin, pathname);
    if (!url) return;
    let link = document.head.querySelector<HTMLLinkElement>(CANONICAL);
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.append(link);
    }
    link.href = url;

    // Public pages are indexable: drop any noindex left by a previous route.
    remove(ROBOTS);
    setMeta('name', 'description', page.description);
    setMeta('property', 'og:title', page.title);
    setMeta('property', 'og:description', page.description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', 'My Vedic Star');
  }, [pathname, origin]);

  return null;
}
