import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute } from '../../test/render';

const profile = {
  id: 'u1',
  firstName: 'Raju',
  lastName: 'Bhupathi',
  streetAddress: '1 Main Street',
  streetAddress2: null,
  country: 'US',
  state: 'Texas',
  city: 'Austin',
  postalCode: '78701',
  email: 'aprraju@gmail.com',
  phoneNumber: '+1 512 555 0100',
  revision: 3,
  nameSyncPending: false,
};
const auth = () => createInMemoryAuthClient({ user: { id: 'u1' } });
function backend(pending = false) {
  const requests: unknown[] = [];
  server.use(
    http.get(`${TEST_API_BASE_URL}/api/v1/auth/profile`, () => HttpResponse.json(profile)),
    http.patch(`${TEST_API_BASE_URL}/api/v1/auth/profile`, async ({ request }) => {
      const body = (await request.json()) as { changes: object };
      requests.push(body);
      return HttpResponse.json({ ...profile, ...body.changes, revision: 4, nameSyncPending: pending });
    }),
    http.post(`${TEST_API_BASE_URL}/api/v1/auth/profile/sync`, () =>
      HttpResponse.json({ ...profile, revision: 4, nameSyncPending: false }),
    ),
  );
  return requests;
}
describe('Profile', () => {
  it('loads all ten fields in order and sends only edited fields', async () => {
    const requests = backend();
    renderRoute('/profile', { auth: auth() });
    await waitFor(() => expect(screen.getByLabelText('First Name')).toHaveValue('Raju'));
    expect(
      Array.from(
        screen.getByRole('button', { name: 'Save' }).closest('form')?.querySelectorAll('input') ?? [],
      ).map((input) => input.getAttribute('autocomplete')),
    ).toEqual([
      'given-name',
      'family-name',
      'address-line1',
      'address-line2',
      'country',
      'address-level1',
      'address-level2',
      'postal-code',
      'email',
      'tel',
    ]);
    await userEvent.clear(screen.getByLabelText('Street Address 2'));
    await userEvent.type(screen.getByLabelText('Street Address 2'), 'Apartment 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Your profile has been saved.')).toBeInTheDocument();
    expect(requests).toEqual([{ revision: 3, changes: { streetAddress2: 'Apartment 2' } }]);
  });
  it('clears dependent geography when country changes and preserves street fields', async () => {
    backend();
    renderRoute('/profile', { auth: auth() });
    await waitFor(() => expect(screen.getByLabelText('Country')).toHaveValue('US'));
    await userEvent.clear(screen.getByLabelText('Country'));
    await userEvent.type(screen.getByLabelText('Country'), 'IN');
    expect(screen.getByLabelText('State / Province')).toHaveValue('');
    expect(screen.getByLabelText('City')).toHaveValue('');
    expect(screen.getByLabelText('ZIP / Postal Code')).toHaveValue('');
    expect(screen.getByLabelText('Street Address')).toHaveValue('1 Main Street');
  });
  it('reports durable name-sync partial success and allows safe retry', async () => {
    backend(true);
    renderRoute('/profile', { auth: auth() });
    await waitFor(() => expect(screen.getByLabelText('First Name')).toHaveValue('Raju'));
    await userEvent.type(screen.getByLabelText('First Name'), ' Kumar');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const retry = await screen.findByRole('button', { name: 'Retry name synchronization' });
    expect(screen.getByText(/Your profile is saved/)).toBeInTheDocument();
    await userEvent.click(retry);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Retry name synchronization' })).not.toBeInTheDocument(),
    );
  });
});
