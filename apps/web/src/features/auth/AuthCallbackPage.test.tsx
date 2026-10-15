import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { type AuthClient, createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { renderRoute } from '../../test/render';

describe('sign-in entry points (no login/register pages)', () => {
  it.each([['Login', 'login']] as const)(
    'header %s starts %s at the identity provider and lands on Home (the Panchang page)',
    async (name, intent) => {
      const auth = createInMemoryAuthClient();
      const { router } = renderRoute('/about', { auth });
      const banner = await screen.findByRole('banner');
      // Rendered in both the compact menu and the wide header (CSS shows one).
      await userEvent.click(within(banner).getAllByRole('button', { name })[0]!);
      expect(auth.requests).toEqual([{ intent, returnTo: '/calendar' }]);
      await waitFor(() => expect(router.state.location.pathname).toBe('/calendar'));
    },
  );

  it('hides Login and Register when sign-in is not configured', async () => {
    renderRoute('/about');
    const banner = await screen.findByRole('banner');
    expect(within(banner).queryByRole('button', { name: /login|register/i })).not.toBeInTheDocument();
  });

  it('shows a sign-in error if the redirect cannot start', async () => {
    const auth: AuthClient = {
      ...createInMemoryAuthClient(),
      signIn: vi.fn().mockRejectedValue(new Error('offline')),
    };
    const { router } = renderRoute('/about', { auth });
    await userEvent.click(
      within(await screen.findByRole('banner')).getAllByRole('button', { name: 'Login' })[0]!,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't sign you in");
    expect(router.state.location.pathname).toBe('/auth/callback');
  });
});

describe('AuthCallbackPage', () => {
  it('completes sign-in and continues to the validated destination', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    auth.completeSignIn = async () => ({ ok: true, returnTo: '/good-time' });
    const { router } = renderRoute('/auth/callback?code=abc&state=xyz', { auth });
    await waitFor(() => expect(router.state.location.pathname).toBe('/good-time'));
  });

  it('never follows an unsafe destination from the provider round trip', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    auth.completeSignIn = async () => ({ ok: true, returnTo: '//evil.example/steal' });
    const { router } = renderRoute('/auth/callback?code=abc', { auth });
    await waitFor(() => expect(router.state.location.pathname).toBe('/calendar'));
  });

  it('replaces the code in the URL with an error code on failure', async () => {
    const auth = createInMemoryAuthClient();
    auth.completeSignIn = async () => ({ ok: false, reason: 'cancelled', returnTo: '/dashboard' });
    const { router } = renderRoute('/auth/callback?code=abc&state=xyz', { auth });
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in was cancelled');
    expect(router.state.location.search).not.toContain('code=');
    expect(new URLSearchParams(router.state.location.search).get('signin_error')).toBe('cancelled');
  });

  it('processes a provider error response instead of treating it as the app error view', async () => {
    const auth = createInMemoryAuthClient();
    const complete = vi.fn(async () => ({
      ok: false as const,
      reason: 'cancelled' as const,
      returnTo: '/dashboard',
    }));
    auth.completeSignIn = complete;
    renderRoute('/auth/callback?error=access_denied&error_description=AADSTS%3Cb%3E&state=s1', { auth });
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in was cancelled');
    expect(complete).toHaveBeenCalledOnce();
    expect(screen.queryByText(/AADSTS/)).not.toBeInTheDocument();
  });

  it.each([
    ['cancelled', 'Sign-in was cancelled'],
    ['network', "We couldn't reach the sign-in service"],
    ['failed', "We couldn't sign you in"],
    ['<b>hacked</b>', "We couldn't sign you in"],
  ])('shows a friendly message for error code %s (never provider text)', async (code, message) => {
    const { container } = renderRoute(`/auth/callback?signin_error=${encodeURIComponent(code)}`, {
      auth: createInMemoryAuthClient(),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(container).not.toHaveTextContent('hacked');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('"Try again" restarts sign-in for the original destination', async () => {
    const auth = createInMemoryAuthClient();
    renderRoute('/auth/callback?signin_error=cancelled&returnTo=%2Fgood-time', { auth });
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(auth.requests).toEqual([{ intent: 'login', returnTo: '/good-time' }]);
  });

  it('offers a way home', async () => {
    renderRoute('/auth/callback?signin_error=failed', { auth: createInMemoryAuthClient() });
    await screen.findByRole('alert');
    const main = screen.getByRole('main');
    expect(await within(main).findByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });
});
