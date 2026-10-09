import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { axeViolations } from '../../test/axe';
import { renderRoute } from '../../test/render';

/** Each page's text comes from its own Markdown file in src/content/pages/. */
describe('content pages', () => {
  it.each([
    ['/about', 'About Us'],
    ['/how-it-works', 'How It Works'],
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Use'],
    ['/disclaimer', 'Disclaimer'],
    ['/cookies', 'Cookie Policy'],
    ['/accessibility', 'Accessibility'],
  ])('%s renders its document', async (url, heading) => {
    const { container } = renderRoute(url);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('shows the full Privacy Policy text supplied for the site', async () => {
    renderRoute('/privacy');
    await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' });
    expect(screen.getByText('Last Updated: October 1, 2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Location Information' })).toBeInTheDocument();
    expect(screen.getByText('We do not sell your personal information.')).toBeInTheDocument();
  });

  it('carries the Muhurta consultation advice in the Disclaimer', async () => {
    renderRoute('/disclaimer');
    expect(
      await screen.findByText(
        'For important life events, please consult a qualified astrologer for a personalized Muhurta.',
      ),
    ).toBeInTheDocument();
  });
});
