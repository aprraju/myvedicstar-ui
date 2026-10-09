import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { renderRoute } from '../../test/render';

describe('routing', () => {
  it('renders the public home page with landmarks, header controls and a skip link', async () => {
    const { container } = renderRoute('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: /find auspicious moments/i }),
    ).toBeInTheDocument();
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('link', { name: 'Features' })).toHaveAttribute('href', '/#features');
    expect(within(banner).getByRole('link', { name: 'About' })).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Help' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Choose location' })).toBeInTheDocument();
    expect(within(banner).queryByRole('combobox', { name: 'Tradition' })).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).not.toHaveTextContent('GeoNames');
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    await waitFor(() => expect(document.title).toBe('Home · My Vedic Star'));
    expect(await axeViolations(container)).toEqual([]);
  });

  it('explains the product features without exposing the dashboard', async () => {
    renderRoute('/', { auth: createInMemoryAuthClient() });
    const features = await screen.findByRole('region', { name: 'Everything You Need in One Place' });
    for (const title of [
      "Today's Panchang",
      'Find a Good Time',
      'Calendar View',
      'Festivals & Observances',
      'Global Support',
      'Multiple Traditions',
    ]) {
      expect(within(features).getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
    }
    const getStarted = within(features).getByRole('region', { name: 'Get Started for Free' });
    expect(within(getStarted).getByRole('button', { name: 'Register' })).toBeInTheDocument();
    expect(within(getStarted).getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it.each([
    ['/about', 'About Us'],
    ['/help', 'Help'],
  ])('renders %s', async (url, heading) => {
    const { container } = renderRoute(url);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('opens and closes the compact navigation menu', async () => {
    renderRoute('/');
    const toggle = await screen.findByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows a not-found page for unknown routes', async () => {
    renderRoute('/no-such-page');
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('signed-in home', () => {
  it('takes signed-in users from Home (/) to their dashboard', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    const { router } = renderRoute('/', { auth });
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('points the Home navigation item at the dashboard', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    renderRoute('/calendar', { auth });
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/dashboard');
    // Today (between Home and Calendar) also opens the dashboard for now.
    expect(within(nav).getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/dashboard');
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(expect.arrayContaining(['Home', 'Today', 'Calendar', 'Upcoming Events', 'Find Good Time']));
  });

  it('still shows the public home page to signed-out visitors', async () => {
    const { router } = renderRoute('/', { auth: createInMemoryAuthClient() });
    expect(
      await screen.findByRole('heading', { level: 1, name: /find auspicious moments/i }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('protected routes', () => {
  it('send unauthenticated users straight to the identity provider, preserving the destination', async () => {
    const auth = createInMemoryAuthClient();
    renderRoute('/dashboard?tab=today', { auth });
    await waitFor(() =>
      expect(auth.requests).toEqual([{ intent: 'login', returnTo: '/dashboard?tab=today' }]),
    );
  });

  it('protect Find a Good Time and return to it after signing in', async () => {
    const auth = createInMemoryAuthClient();
    const { router } = renderRoute('/good-time', { auth });
    expect(await screen.findByRole('heading', { level: 1, name: 'Find a Good Time' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/good-time');
  });

  it('explain that sign-in is unavailable when it is not configured', async () => {
    renderRoute('/dashboard');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Please sign in to continue.' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sign-in is not available yet/)).toBeInTheDocument();
  });

  it('show a clearly labelled "coming soon" page for Settings to signed-in users', async () => {
    renderRoute('/settings', { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('This part of My Vedic Star is coming soon.')).toBeInTheDocument();
  });

  it('no longer serve login or register pages', async () => {
    renderRoute('/login');
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });

  it('let authenticated users reach the dashboard and sign out', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    const signOut = vi.spyOn(auth, 'signOut');
    renderRoute('/dashboard', { auth });
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
