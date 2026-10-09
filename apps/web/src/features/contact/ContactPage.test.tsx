import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { apiRequests, scenarios, TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute } from '../../test/render';

const fill = async (fields: { name?: string; email?: string; reason?: string; message?: string }) => {
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
  it('offers name, email, reason (with the seven reasons) and message', async () => {
    const { container } = renderRoute('/contact');
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
    renderRoute('/contact');
    await screen.findByRole('heading', { level: 1, name: 'Contact Us' });
    await fill({ email: 'not-an-email', message: 'short' });
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText(/^Enter a valid email address/)).toBeInTheDocument();
    expect(screen.getByText('Choose a reason.')).toBeInTheDocument();
    expect(screen.getByText('Write at least 10 characters.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');
    expect(apiRequests.some((u) => u.pathname.endsWith('/contact'))).toBe(false);
  });

  it('submits and confirms that the request was received', async () => {
    let body: unknown;
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/v1/contact`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 202 });
      }),
    );
    renderRoute('/contact');
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
      name: 'Asha',
      email: 'asha@example.com',
      reason: 'feedback',
      message: 'Lovely calendar, thank you!',
    });
  });

  it('Report an Issue preselects Technical Issue', async () => {
    renderRoute('/contact?reason=technical');
    expect(await screen.findByRole('combobox', { name: 'Reason' })).toHaveValue('technical');
  });

  it('prefills the signed-in user’s name and email from their profile', async () => {
    renderRoute('/contact', { auth: createInMemoryAuthClient({ user: { id: 'u1' } }) });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Asha Rao'));
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('asha.rao@example.com');
  });

  it('keeps the message and explains when sending fails', async () => {
    server.use(scenarios.serverError('/contact', 'post'));
    renderRoute('/contact');
    await screen.findByRole('heading', { level: 1, name: 'Contact Us' });
    await fill({ name: 'Asha', email: 'asha@example.com', reason: 'other', message: 'Please call me back.' });
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText("We couldn't send your message. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Please call me back.');
  });
});
