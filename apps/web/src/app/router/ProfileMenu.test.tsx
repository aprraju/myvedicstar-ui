import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { apiRequests, scenarios } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute } from '../../test/render';

const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Token Name' } });

describe('Profile menu', () => {
  it('replaces Sign out with a profile icon that shows name, email, Settings and Log out from userinfo', async () => {
    const { container } = renderRoute('/about', { auth: signedIn() });
    const banner = await screen.findByRole('banner');
    expect(within(banner).queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();

    const trigger = within(banner).getByRole('button', { name: 'Open account menu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    expect(await within(banner).findByText('Asha Rao')).toBeInTheDocument();
    expect(within(banner).getByText('asha.rao@example.com')).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(within(banner).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('completes sign-in with a single POST /auth/userinfo carrying the access token', async () => {
    renderRoute('/about', { auth: signedIn() });
    await userEvent.click(await screen.findByRole('button', { name: 'Open account menu' }));
    await screen.findByText('Asha Rao');
    await userEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
    expect(apiRequests.filter((u) => u.pathname.endsWith('/auth/userinfo'))).toHaveLength(1);
  });

  it('logs out from the menu', async () => {
    const auth = signedIn();
    const signOut = vi.spyOn(auth, 'signOut');
    renderRoute('/about', { auth });
    await userEvent.click(await screen.findByRole('button', { name: 'Open account menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('closes with Escape and returns focus to the profile button', async () => {
    renderRoute('/about', { auth: signedIn() });
    const trigger = await screen.findByRole('button', { name: 'Open account menu' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('falls back to the identity token name if userinfo is unavailable', async () => {
    server.use(scenarios.serverError('/auth/userinfo', 'post'));
    renderRoute('/about', { auth: signedIn() });
    await userEvent.click(await screen.findByRole('button', { name: 'Open account menu' }));
    await waitFor(() => expect(screen.getByText('Token Name')).toBeInTheDocument());
  });

  it('is not shown to signed-out visitors', async () => {
    renderRoute('/about', { auth: createInMemoryAuthClient() });
    await screen.findByRole('banner');
    expect(screen.queryByRole('button', { name: 'Open account menu' })).not.toBeInTheDocument();
  });
});
