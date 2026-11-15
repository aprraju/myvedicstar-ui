import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '../../test/render';

/** One public page per route: title text rendered as its h1, plus the route. */
const pages = [
  ['/', 'Hindu Panchang for Your Location — Daily Timings'],
  ['/about', 'About Us — Why We Build the Panchang'],
  ['/how-it-works', 'How the Panchang Is Calculated'],
  ['/privacy', 'Privacy Policy — How We Handle Your Data'],
  ['/terms', 'Terms of Use — Your Agreement with Us'],
  ['/disclaimer', 'Disclaimer — What the Panchang Can Tell You'],
  ['/cookies', 'Cookie Policy — Cookies and Local Storage'],
  ['/accessibility', 'Accessibility — How We Meet WCAG'],
  ['/contact', 'Contact Us — Feedback and Support'],
  ['/help', 'Help and Frequently Asked Questions'],
] as const;

const titleFor = (pageTitle: string) => `${pageTitle} · My Vedic Star`;

describe('per-page titles and Open Graph tags', () => {
  it.each(pages)(
    '%s sets its own document title',
    async (path, pageTitle) => {
      renderRoute(path);
      await waitFor(() => expect(document.title).toBe(titleFor(pageTitle)));
    },
    30000,
  );

  it('never reuses a title or description across pages', () => {
    const titles = pages.map(([, pageTitle]) => pageTitle);
    expect(new Set(titles).size).toBe(pages.length);
  });

  it('keeps the route title plus site name for non-public routes', async () => {
    renderRoute('/calendar');
    await waitFor(() => expect(document.title).toBe('Panchang · My Vedic Star'));
  }, 30000);
});
