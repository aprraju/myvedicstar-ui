/**
 * Per-page search metadata for the ten public content pages.
 *
 * This is the single source every consumer derives from, so a page can never describe itself one way in the browser and
 * another way to a crawler:
 * - the SPA writes `<title>`, `<meta name="description">` and the Open Graph tags from it,
 * - the deployment gate (`infrastructure/web/static-web-apps`) can render the same values alongside the page content
 *   once the render strategy for SEO-3A is decided.
 *
 * Only the ten public pages appear here. Gated routes carry none: they are not part of the public GEO surface.
 * Copy is English-only, matching the current UI default; translations belong in the localization catalog.
 */

export interface PageMetadata {
  /** Site path, exactly as registered in the router. */
  readonly path: string;
  /** Document title, without the site name suffix. Max 60 characters. */
  readonly title: string;
  /** Meta description and `og:description`. 110–160 characters. */
  readonly description: string;
}

/** The ten public content pages, in navigation order. */
export const publicPageMetadata: readonly PageMetadata[] = [
  {
    path: '/',
    title: 'Hindu Panchang for Your Location — Daily Timings',
    description:
      'Tithi, Nakshatra, Yoga, Karana, Vara, sunrise, Rahu Kalam and the day’s favorable periods, calculated for your exact location and time zone.',
  },
  {
    path: '/about',
    title: 'About Us — Why We Build the Panchang',
    description:
      'My Vedic Star makes the Hindu Panchang easy to understand: simple daily guidance for beginners, every detail available for experienced users.',
  },
  {
    path: '/how-it-works',
    title: 'How the Panchang Is Calculated',
    description:
      'How the daily Panchang is computed: the five Panchanga limbs, sunrise and sunset, Rahu Kalam, Yamagandam, Gulika, Varjyam and Durmuhurtam explained.',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — How We Handle Your Data',
    description:
      'What My Vedic Star collects, how your saved locations and account settings are used, and the choices you have over your data.',
  },
  {
    path: '/terms',
    title: 'Terms of Use — Your Agreement with Us',
    description:
      'The terms that apply when you use My Vedic Star, including acceptable use, accounts, the nature of Panchang guidance, and limitations of liability.',
  },
  {
    path: '/disclaimer',
    title: 'Disclaimer — What the Panchang Can Tell You',
    description:
      'Panchang timings are astronomical calculations, not personal astrological advice. What My Vedic Star can and cannot tell you about a day.',
  },
  {
    path: '/cookies',
    title: 'Cookie Policy — Cookies and Local Storage',
    description:
      'Which cookies and local storage My Vedic Star uses for sign-in, saved locations and settings, and how to control them in your browser.',
  },
  {
    path: '/accessibility',
    title: 'Accessibility — How We Meet WCAG',
    description:
      'How My Vedic Star is built to be keyboard accessible, screen-reader friendly and readable on phones, tablets and desktop, and how to report a barrier.',
  },
  {
    path: '/contact',
    title: 'Contact Us — Feedback and Support',
    description:
      'Send feedback, report a problem with a Panchang calculation, or ask a question about your account — we read every message.',
  },
  {
    path: '/help',
    title: 'Help and Frequently Asked Questions',
    description:
      'Answers about changing your location, choosing a tradition, reading the timeline, and understanding Rahu Kalam and the other Panchang periods.',
  },
] as const;

/** Metadata for one path, or `undefined` when the path is not a public content page. */
export function pageMetadataFor(pathname: string): PageMetadata | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return publicPageMetadata.find((page) => page.path === path);
}
