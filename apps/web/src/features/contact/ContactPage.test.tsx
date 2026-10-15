import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { apiRequests, scenarios, TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute } from '../../test/render';

const fill = async (fields: { name?: string; email?: string; reason?: string; message?: string }) => {
  if (fields.message && fields.message.length >= 10)
    await userEvent.type(screen.getByRole('textbox', { name: 'Subject' }), 'A question');
  if (fields.name !== undefined)
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), fields.name);
  if (fields.email !== undefined)
    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), fields.email);
  if (fields.reason !== undefined) {
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Reason' }), fields.reason);
  }
  if (fields.message !== undefined) {
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), fields.message);
  }
};

describe('Contact Us', () => {
  beforeEach(() => server.use(scenarios.serverError('/auth/userinfo', 'post')));
  it('offers name, email, reason (with the seven reasons) and message', async () => {
    const { container } = renderRoute('/contact', { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    expect(await screen.findByRole('heading', { level: 1, name: 'Contact Us' })).toBeInTheDocument();
    const reasons = within(screen.getByRole('combobox', { name: 'Reason' }))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(reasons).toEqual([
      'Choose a reason',
      'General Question',
      'Technical Issue',
      'Panchang/Calculation Question',
      'Account/Login Issue',
      'Privacy Request',
      'Feedback',
      'Other',
    ]);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('explains each missing or invalid field', async () => {
    renderRoute('/contact', { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    await screen.findByRole('heading', { level: 1, name: 'Contact Us' });
    await fill({ email: 'not-an-email', message: 'short' });
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText(/^Enter a valid email address/)).toBeInTheDocument();
    expect(screen.getByText('Choose a reason.')).toBeInTheDocument();
    expect(screen.getByText('Write at least 10 characters.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');
    expect(apiRequests.some((u) => u.pathname.endsWith('/email/send'))).toBe(false);
  });

  it('submits and confirms that the request was received', async () => {
    let body: unknown;
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/v1/email/send`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 202 });
      }),
    );
    renderRoute('/contact', { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    await screen.findByRole('heading', { level: 1, name: 'Contact Us' });
    await fill({
      name: 'Asha',
      email: 'asha@example.com',
      reason: 'feedback',
      message: 'Lovely calendar, thank you!',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByText(
        'Your request has been submitted and we will get back to you as soon as possible.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Thank you' })).toHaveFocus();
    expect(body).toEqual({
      email: 'asha@example.com',
      phoneNumber: null,
      subject: 'A question',
      type: 'Feedback',
      reason: 'feedback',
      message: 'Lovely calendar, thank you!',
    });
  });

  it('Report an Issue preselects Technical Issue', async () => {
    renderRoute('/contact?reason=technical', { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    expect(await screen.findByRole('combobox', { name: 'Reason' })).toHaveValue('technical');
  });

  it('Beta Feedback and Report an Issue open their own form with the reason chosen', async () => {
    const auth = createInMemoryAuthClient({ user: { id: 'u1' } });
    const { router } = renderRoute('/contact?reason=feedback', { auth });
    expect(await screen.findByRole('heading', { level: 1, name: 'Beta Feedback' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Reason' })).toHaveValue('feedback');
    await router.navigate('/contact?reason=technical');
    expect(await screen.findByRole('heading', { level: 1, name: 'Report an Issue' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Reason' })).toHaveValue('technical');
  });

  it('falls back to the sign-in name and email when the profile has none', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/v1/auth/userinfo`, () =>
        HttpResponse.json({ id: 'u1', name: null, givenName: null, surname: null, email: null }),
      ),
    );
    renderRoute('/contact?reason=feedback', {
      auth: createInMemoryAuthClient({
        user: { id: 'u1', displayName: 'Token Name', email: 'token@example.com' },
      }),
    });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Token Name'));
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('token@example.com');
  });

  it('prefills the signed-in user’s name and email from their profile', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/v1/auth/userinfo`, () =>
        HttpResponse.json({
          id: 'u1',
          name: 'Asha Rao',
          givenName: 'Asha',
          surname: 'Rao',
          email: 'asha.rao@example.com',
        }),
      ),
    );
    renderRoute('/contact', { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Asha Rao'));
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('asha.rao@example.com');
  });

  it('keeps the message and explains when sending fails', async () => {
    server.use(scenarios.serverError('/email/send', 'post'));
    renderRoute('/contact', { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    await screen.findByRole('heading', { level: 1, name: 'Contact Us' });
    await fill({ name: 'Asha', email: 'asha@example.com', reason: 'other', message: 'Please call me back.' });
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    // The client retries a server error before reporting it, so allow more than the default second.
    expect(
      await screen.findByText("We couldn't send your message. Please try again.", undefined, {
        timeout: 5000,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Please call me back.');
  });
});

describe('Public email communication', () => {
  it('submits Contact Us without signing in and disables repeated clicks while delivering', async () => {
    let accept!: () => void;
    const acceptance = new Promise<void>((resolve) => {
      accept = resolve;
    });
    let calls = 0;
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/v1/email/send`, async ({ request }) => {
        calls++;
        expect(request.headers.has('Authorization')).toBe(false);
        const body = (await request.json()) as { type: string; reason: string };
        expect(body).toMatchObject({ type: 'ContactUs', reason: 'general' });
        await acceptance;
        return HttpResponse.json({ success: true, message: 'Submitted' });
      }),
    );
    renderRoute('/contact', { auth: createInMemoryAuthClient() });
    await screen.findByRole('heading', { level: 1, name: 'Contact Us' });
    await fill({
      name: 'Visitor',
      email: 'visitor@example.com',
      reason: 'general',
      message: 'Please help with the calendar.',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Submit/ })).toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /Submit/ }));
    expect(calls).toBe(1);
    accept();
    expect(await screen.findByRole('heading', { name: 'Thank you' })).toBeInTheDocument();
  });
});
