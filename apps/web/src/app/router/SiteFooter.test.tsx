import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { renderRoute } from '../../test/render';

const footer = () => screen.getByRole('contentinfo');

describe('Site footer', () => {
  it('shows MyVedicStar, Help and Legal links, copyright and the informational notice to everyone', async () => {
    const { container } = renderRoute('/about');
    await screen.findByRole('heading', { level: 1, name: 'About Us' });
    const link = (name: string) => within(footer()).getByRole('link', { name });
    expect(link('About Us')).toHaveAttribute('href', '/about');
    expect(link('How It Works')).toHaveAttribute('href', '/how-it-works');
    expect(link('Contact Us')).toHaveAttribute('href', '/contact');
    expect(link('Help / FAQ')).toHaveAttribute('href', '/help');
    expect(link('Report an Issue')).toHaveAttribute('href', '/contact?reason=technical');
    expect(link('Privacy Policy')).toHaveAttribute('href', '/privacy');
    expect(link('Terms of Use')).toHaveAttribute('href', '/terms');
    expect(link('Disclaimer')).toHaveAttribute('href', '/disclaimer');
    expect(link('Cookie Policy')).toHaveAttribute('href', '/cookies');
    expect(link('Accessibility')).toHaveAttribute('href', '/accessibility');
    expect(footer()).toHaveTextContent(`© ${new Date().getFullYear()} MyVedicStar. All rights reserved.`);
    expect(footer()).toHaveTextContent('Traditional Vedic guidance for informational purposes.');
    expect(footer()).toHaveTextContent(
      'Important decisions should not rely solely on information provided by MyVedicStar.',
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it('hides Explore from signed-out visitors', async () => {
    renderRoute('/about', { auth: createInMemoryAuthClient() });
    await screen.findByRole('heading', { level: 1, name: 'About Us' });
    expect(within(footer()).queryByRole('heading', { name: 'Explore' })).not.toBeInTheDocument();
    expect(within(footer()).queryByRole('link', { name: 'Panchang' })).not.toBeInTheDocument();
  });

  it('shows Explore to signed-in users, with future features marked coming soon', async () => {
    renderRoute('/about', { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    await screen.findByRole('heading', { level: 1, name: 'About Us' });
    const explore = within(footer()).getByRole('region', { name: 'Explore' });
    expect(within(explore).getByRole('link', { name: "Today's Panchang" })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(within(explore).getByRole('link', { name: 'Find a Good Time' })).toHaveAttribute(
      'href',
      '/good-time',
    );
    expect(within(explore).getByRole('link', { name: 'Panchang' })).toHaveAttribute(
      'href',
      '/calendar',
    );
    expect(within(explore).queryByRole('link', { name: /Compatibility|Matrimony/ })).not.toBeInTheDocument();
    expect(explore).toHaveTextContent('Compatibility Coming soon');
    expect(explore).toHaveTextContent('Matrimony Coming soon');
  });
});
