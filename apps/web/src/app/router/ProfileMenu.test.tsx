import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { apiRequests, scenarios, TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute } from '../../test/render';

const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Token Name' } });

// The header and the mobile bottom navigation each render a ProfileMenu (CSS shows one per window size; jsdom has no
// CSS), so lookups that expect exactly one match are scoped to the header (banner).
describe('Profile menu', () => {
  it('uses the minimal userinfo response for two profile lines', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/v1/auth/userinfo`, () =>
        HttpResponse.json({
          id: '30b36ac7-c687-452a-b5f6-06f62139dbca',
          name: 'Raju,Bhupathi',
          email: 'aprraju@gmail.com',
        }),
      ),
    );
    renderRoute('/calendar', { auth: signedIn() });
    await userEvent.click(await screen.findByRole('button', { name: 'Open account menu' }));
    const banner = within(screen.getByRole('banner'));
    const name = await banner.findByText('Raju,Bhupathi');
    const email = banner.getByText('aprraju@gmail.com');
    expect(name.tagName).toBe('P');
    expect(email.tagName).toBe('P');
    expect(name.nextElementSibling).toBe(email);
    expect(banner.queryByText('Token Name')).not.toBeInTheDocument();
  });

  it('keeps the identity-provider email visible when userinfo has no name or email', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/v1/auth/userinfo`, () =>
        HttpResponse.json({
          id: 'u1',
          name: null,
          givenName: null,
          surname: null,
          email: null,
        }),
      ),
    );
    const auth = createInMemoryAuthClient({ user: { id: 'u1', email: 'asha.rao@example.com' } });
    renderRoute('/about', { auth });
    await userEvent.click(await screen.findByRole('button', { name: 'Open account menu' }));
    expect(await within(screen.getByRole('banner')).findByText('asha.rao@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it.each([null, '', '   ', 'Unknown'])('shows only email when the profile name is %s', async (name) => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/v1/auth/userinfo`, () =>
        HttpResponse.json({
          id: 'u1',
          name,
          givenName: null,
          surname: null,
          email: 'asha.rao@example.com',
        }),
      ),
    );
    renderRoute('/about', { auth: signedIn() });
    await userEvent.click(await screen.findByRole('button', { name: 'Open account menu' }));
    await within(screen.getByRole('banner')).findByText('asha.rao@example.com');
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
    expect(screen.queryByText('Token Name')).not.toBeInTheDocument();
  });

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
    await within(screen.getByRole('banner')).findByText('Asha Rao');
    await userEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
    expect(apiRequests.filter((u) => u.pathname.endsWith('/auth/userinfo'))).toHaveLength(1);
  });

  it('reuses userinfo across page navigation', async () => {
    const { router } = renderRoute('/about', { auth: signedIn() });
    await userEvent.click(await screen.findByRole('button', { name: 'Open account menu' }));
    await within(screen.getByRole('banner')).findByText('Asha Rao');
    await act(() => router.navigate('/contact'));
    await screen.findByRole('heading', { level: 1, name: 'Contact Us' });
    await act(() => router.navigate('/calendar'));
    await userEvent.click(await screen.findByRole('button', { name: 'Open account menu' }));
    await within(screen.getByRole('banner')).findByText('Asha Rao');
    expect(apiRequests.filter((u) => u.pathname.endsWith('/auth/userinfo'))).toHaveLength(1);
  });

  it('does not retry a failed login POST when another page mounts', async () => {
    let calls = 0;
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/v1/auth/userinfo`, () => {
        calls += 1;
        return HttpResponse.json({ message: 'Unavailable' }, { status: 500 });
      }),
    );
    const { router, services } = renderRoute('/about', { auth: signedIn() });
    await waitFor(() =>
      expect(services.queryClient.getQueryState(['auth', 'userinfo', 'u1'])?.status).toBe('error'),
    );
    await act(() => router.navigate('/contact'));
    await screen.findByRole('heading', { level: 1, name: 'Contact Us' });
    await waitFor(() => expect(services.queryClient.isFetching()).toBe(0));
    expect(calls).toBe(1);
  });

  it('requests userinfo again for a new login and a full app refresh', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'mock-user' } });
    const first = renderRoute('/about', { auth });
    await waitFor(() =>
      expect(first.services.queryClient.getQueryState(['auth', 'userinfo', 'mock-user'])?.status).toBe(
        'success',
      ),
    );
    await act(() => auth.signOut());
    await act(() => auth.signIn({ returnTo: '/about', intent: 'login' }));
    await waitFor(() =>
      expect(apiRequests.filter((u) => u.pathname.endsWith('/auth/userinfo'))).toHaveLength(2),
    );
    await waitFor(() => expect(first.services.queryClient.isFetching()).toBe(0));
    first.unmount();
    const refreshed = renderRoute('/about', { auth });
    await waitFor(() =>
      expect(refreshed.services.queryClient.getQueryState(['auth', 'userinfo', 'mock-user'])?.status).toBe(
        'success',
      ),
    );
    expect(apiRequests.filter((u) => u.pathname.endsWith('/auth/userinfo'))).toHaveLength(3);
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
    await waitFor(() =>
      expect(within(screen.getByRole('banner')).getByText('Token Name')).toBeInTheDocument(),
    );
  });

  it('is not shown to signed-out visitors', async () => {
    renderRoute('/about', { auth: createInMemoryAuthClient() });
    await screen.findByRole('banner');
    expect(screen.queryByRole('button', { name: 'Open account menu' })).not.toBeInTheDocument();
  });
});
