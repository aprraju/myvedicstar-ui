import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { createTestConfig, renderRoute } from '../../test/render';

const profile = {
  id: 'u1',
  firstName: 'Raju',
  lastName: 'Bhupathi',
  displayName: 'Raju B',
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
  it('populates address fields from the selected city suggestion', async () => {
    backend();
    const place = {
      id: 'city-1',
      city: 'Liberty Hill',
      region: 'Texas',
      country: 'United States',
      countryCode: 'US',
      postalCode: '78642',
      latitude: 30.6649,
      longitude: -97.9225,
      source: 'city',
    };
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/v1/locations/countries`, () =>
        HttpResponse.json({ results: [{ code: 'US', name: 'United States' }] }),
      ),
      http.get(`${TEST_API_BASE_URL}/api/v1/locations/regions`, () =>
        HttpResponse.json({ results: [{ code: 'TX', name: 'Texas' }] }),
      ),
      http.get(`${TEST_API_BASE_URL}/api/v1/locations/address-cities`, ({ request }) => {
        expect(request.headers.get('Authorization')).toMatch(/^Bearer /);
        expect(new URL(request.url).searchParams.get('region')).toBe('TX');
        return HttpResponse.json({ results: [place] });
      }),
      http.get(`${TEST_API_BASE_URL}/api/v1/locations/postal`, () => HttpResponse.json({ results: [] })),
    );
    renderRoute('/profile', {
      auth: auth(),
      config: createTestConfig({ locationSearch: { enabled: true } }),
    });
    await waitFor(() => expect(screen.getByLabelText('Country')).toHaveValue('US'));
    await userEvent.clear(screen.getByLabelText('City'));
    await userEvent.type(screen.getByLabelText('City'), 'Liberty');
    await userEvent.click(
      await screen.findByRole('button', { name: '78642, Liberty Hill, Texas, United States' }),
    );
    expect(screen.getByLabelText('Country')).toHaveValue('US');
    expect(screen.getByLabelText('State / Province')).toHaveValue('Texas');
    expect(screen.getByLabelText('City')).toHaveValue('Liberty Hill');
    expect(screen.getByLabelText('ZIP / Postal Code')).toHaveValue('78642');
    expect(screen.getByLabelText('Street Address')).toHaveValue('1 Main Street');
  });
  it('loads all eleven fields in order and sends only edited fields', async () => {
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
      'nickname',
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
  it('shows the display name after the last name and saves a changed display name', async () => {
    const requests = backend();
    renderRoute('/profile', { auth: auth() });
    const displayName = await screen.findByLabelText('Display Name');
    await waitFor(() => expect(displayName).toHaveValue('Raju B'));
    const labels = Array.from(document.querySelectorAll('form label')).map((label) => label.textContent);
    expect(labels.slice(0, 3)).toEqual(['First Name', 'Last Name', 'Display Name']);
    await userEvent.clear(displayName);
    await userEvent.type(displayName, '  Raju  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Your profile has been saved.')).toBeInTheDocument();
    expect(requests).toEqual([{ revision: 3, changes: { displayName: 'Raju' } }]);
    expect(displayName).toHaveValue('Raju');
  });
  it('requires a display name, which the API cannot clear', async () => {
    const requests = backend();
    renderRoute('/profile', { auth: auth() });
    const displayName = await screen.findByLabelText('Display Name');
    await waitFor(() => expect(displayName).toHaveValue('Raju B'));
    await userEvent.clear(displayName);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a display name.')).toBeInTheDocument();
    expect(displayName).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toEqual([]);
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
  it('reports saved profile with pending synchronization without offering manual retry', async () => {
    backend(true);
    renderRoute('/profile', { auth: auth() });
    await waitFor(() => expect(screen.getByLabelText('First Name')).toHaveValue('Raju'));
    await userEvent.type(screen.getByLabelText('First Name'), ' Kumar');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Your profile is saved/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry name synchronization' })).not.toBeInTheDocument();
  });
});
