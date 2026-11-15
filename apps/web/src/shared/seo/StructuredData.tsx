/**
 * Baseline structured data for the public site: one `Organization` and one `WebSite` entity on the homepage.
 *
 * Only facts the application actually holds are emitted — name, site origin, and the site's own favicon as the logo.
 * Nothing is invented: no address, telephone, founding date, social profiles or aggregate rating.
 *
 * The object is added as a `<script type="application/ld+json">` node built from the parsed object (never string
 * concatenation), so it cannot break the document, and it is not inline-script execution, so the CSP needs no
 * `unsafe-inline`.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { useServices } from '../services/ServicesContext';
import { pageMetadataFor } from './page-metadata';
import { siteOrigin } from './site-origin';

const SCRIPT_ID = 'site-jsonld';

export interface StructuredData {
  '@context': 'https://schema.org';
  '@graph': Record<string, unknown>[];
}

/** Organization + WebSite markup for one site origin. Pure, so it can be tested and reused by a server renderer. */
export function buildSiteStructuredData(siteUrl: string, name = 'My Vedic Star'): StructuredData {
  const origin = siteUrl.replace(/\/+$/, '');
  const home = pageMetadataFor('/');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name,
        url: `${origin}/`,
        logo: `${origin}/favicon.svg`,
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name,
        url: `${origin}/`,
        inLanguage: 'en',
        publisher: { '@id': `${origin}/#organization` },
        // Only the real homepage description is published; no invented fields.
        ...(home ? { description: home.description } : {}),
      },
    ],
  };
}

/** Mounted once in the layout; writes the block only on the homepage. */
export function StructuredDataScript() {
  const { pathname } = useLocation();
  const { config } = useServices();
  const origin = siteOrigin(config);
  const isHome = pathname === '/';

  useEffect(() => {
    const existing = document.getElementById(SCRIPT_ID);
    if (!isHome) {
      existing?.remove();
      return;
    }
    const script = existing instanceof HTMLScriptElement ? existing : document.createElement('script');
    script.id = SCRIPT_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(buildSiteStructuredData(origin));
    if (!existing) document.head.append(script);
  }, [isHome, origin]);

  return null;
}
