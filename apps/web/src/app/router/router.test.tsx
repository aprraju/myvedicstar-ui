import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { apiRequests } from '../../test/msw/handlers';
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
    expect(within(banner).queryByRole('button', { name: 'Choose location' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: "Today's summary" })).not.toBeInTheDocument();
    expect(apiRequests).toHaveLength(0);
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
      'Panchang View',
      'Festivals & Observances',
      'Global Support',
      'Multiple Traditions',
    ]) {
      expect(within(features).getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
    }
    const getStarted = within(features).getByRole('region', { name: 'Get Started for Free' });
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
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
  it('takes signed-in users from Home (/) to the Panchang page', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    const { router } = renderRoute('/', { auth });
    await waitFor(() => expect(router.state.location.pathname).toBe('/calendar'));
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('opens the Panchang page for the old Today address', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    const { router } = renderRoute('/dashboard', { auth });
    await waitFor(() => expect(router.state.location.pathname).toBe('/calendar'));
  });

  it('points the Home navigation item at the Panchang page, with no Today item', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    renderRoute('/calendar', { auth });
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/calendar');
    expect(within(nav).queryByRole('link', { name: 'Today' })).not.toBeInTheDocument();
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent)
        .slice(0, 4),
    ).toEqual(['Home', 'Panchang', 'Upcoming Events', 'Find Good Time']);
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
    renderRoute('/festivals?range=60', { auth });
    await waitFor(() =>
      expect(auth.requests).toEqual([{ intent: 'login', returnTo: '/festivals?range=60' }]),
    );
  });

  it('protect Find a Good Time and return to it after signing in', async () => {
    const auth = createInMemoryAuthClient();
    const { router } = renderRoute('/good-time', { auth });
    expect(await screen.findByRole('heading', { level: 1, name: 'Find a Good Time' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/good-time');
  });

  it('explain that sign-in is unavailable when it is not configured', async () => {
    renderRoute('/calendar');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Please sign in to continue.' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sign-in is not available yet/)).toBeInTheDocument();
  });

  it('shows account settings to signed-in users', async () => {
    renderRoute('/settings', { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Default Tradition')).toBeInTheDocument();
    expect(screen.getByLabelText('Default Location')).toBeInTheDocument();
  });

  it('no longer serve login or register pages', async () => {
    renderRoute('/login');
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });

  it('let authenticated users reach their pages and sign out', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    const signOut = vi.spyOn(auth, 'signOut');
    renderRoute('/settings', { auth });
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
