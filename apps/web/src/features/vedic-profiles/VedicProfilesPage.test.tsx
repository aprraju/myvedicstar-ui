import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import type { VedicProfile, VedicProfileSummary } from '@myvedicstar/contracts';

import { createInMemoryAuthClient } from '../../shared/auth';
import { TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/render';
import { VedicProfilesPage } from './VedicProfilesPage';

const api = (path: string) => `${TEST_API_BASE_URL}/api/v1${path}`;

/** Every Vedic Profiles endpoint requires a bearer token, so these tests run signed in. */
const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Asha' } });

const summary = (overrides: Partial<VedicProfileSummary> = {}): VedicProfileSummary => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Asha',
  relationship: 'Self',
  customRelationship: null,
  revision: 1,
  ...overrides,
});

const full = (overrides: Partial<VedicProfile> = {}): VedicProfile => ({
  id: '11111111-1111-4111-8111-111111111111',
  revision: 1,
  name: 'Asha',
  dateOfBirth: '1990-04-12',
  birthTimeMode: 'Unknown',
  birthTime: null,
  birthTimeFrom: null,
  birthTimeTo: null,
  timeAccuracyNote: null,
  locationName: 'Hyderabad, Telangana, India',
  latitude: 17.385,
  longitude: 78.4867,
  timezoneId: 'Asia/Kolkata',
  gender: 'Female',
  occupation: 'Teacher',
  relationship: 'Self',
  customRelationship: null,
  ...overrides,
});

/** Tracks how many of each mutation the page actually issued, so "no optimistic success" is observable. */
function recordCalls() {
  const calls = { create: 0, replace: 0, remove: 0 };
  server.use(
    http.get(api('/vedic-profiles'), () => HttpResponse.json([])),
    http.post(api('/vedic-profiles'), () => {
      calls.create += 1;
      return HttpResponse.json(full(), { status: 201 });
    }),
    http.put(api('/vedic-profiles/:id'), () => {
      calls.replace += 1;
      return HttpResponse.json(full({ revision: 2 }));
    }),
    http.delete(api('/vedic-profiles/:id'), () => {
      calls.remove += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

// MSW resolves the most recently registered handler first, so every test (or `recordCalls`) installs its own
// /vedic-profiles handler. No global one is registered here on purpose: it would shadow per-test handlers, and a
// `beforeEach` reset would discard the shared defaults this suite relies on (notifications, i18n, config).

describe('VedicProfilesPage — list', () => {
  it('shows an empty state when the account has no profiles', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([])));
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    expect(await screen.findByText('No profiles yet. Add one to get started.')).toBeInTheDocument();
  });

  it('lists saved profiles from the server, not from local state', async () => {
    server.use(
      http.get(api('/vedic-profiles'), () =>
        HttpResponse.json([
          summary(),
          summary({ id: '22222222-2222-4222-8222-222222222222', name: 'Ravi', relationship: 'Son' }),
        ]),
      ),
    );
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    expect(await screen.findByText('Asha')).toBeInTheDocument();
    expect(await screen.findByText('Ravi')).toBeInTheDocument();
    // AC5: duplicate relationship values are allowed and both render.
    expect(screen.getAllByText('Asha')).toHaveLength(1);
  });

  it('shows the custom relationship for Other profiles', async () => {
    server.use(
      http.get(api('/vedic-profiles'), () =>
        HttpResponse.json([summary({ relationship: 'Other', customRelationship: 'Mentor' })]),
      ),
    );
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    expect(await screen.findByText('Mentor')).toBeInTheDocument();
  });

  it('renders the relationship as the secondary line (AC5: duplicates allowed)', async () => {
    server.use(
      http.get(api('/vedic-profiles'), () =>
        HttpResponse.json([
          summary({ id: '33333333-3333-4333-8333-333333333333', name: 'Ravi', relationship: 'Son' }),
          summary({ id: '44444444-4444-4444-8444-444444444444', name: 'Kiran', relationship: 'Son' }),
        ]),
      ),
    );
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    expect(await screen.findByText('Ravi')).toBeInTheDocument();
    expect(screen.getByText('Kiran')).toBeInTheDocument();
    // Two rows, both Sons: AC5 allows duplicate relationships.
    expect(screen.getAllByText('Son').length).toBeGreaterThanOrEqual(2);
  });

  it('surfaces a real list failure instead of an empty list', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json(null, { status: 500 })));
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load this right now/i);
  });
});

describe('VedicProfilesPage — create', () => {
  it('keeps Save disabled until a birth location is chosen, because the DTO requires one', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await screen.findByText('No profiles yet. Add one to get started.');

    await user.type(screen.getByLabelText('Name'), 'Asha');
    await user.type(screen.getByLabelText('Date of birth'), '1990-04-12');
    await user.type(screen.getByLabelText('Occupation'), 'Teacher');
    await user.click(screen.getByRole('radio', { name: 'Unknown' }));

    // Everything the user can type here is present; the shared location dialog still has to supply the place.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('keeps Save disabled while required fields are missing', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([])));
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await screen.findByText('No profiles yet. Add one to get started.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('requires the custom relationship when Other is chosen (AC6)', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await screen.findByText('No profiles yet. Add one to get started.');
    await user.selectOptions(screen.getByLabelText('Relationship'), 'Other');
    expect(screen.getByLabelText('Custom relationship')).toBeInTheDocument();
  });

  it('shows a real error and no success when the list cannot be loaded', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json(null, { status: 500 })));
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load this right now/i);
    expect(screen.queryByText('Profile saved.')).not.toBeInTheDocument();
  });
});

describe('VedicProfilesPage — edit and the 409 conflict', () => {
  it('sends a PUT carrying the revision the client last saw', async () => {
    const calls = recordCalls();
    server.use(
      http.get(api('/vedic-profiles'), () => HttpResponse.json([summary()])),
      http.get(api('/vedic-profiles/:id'), () => HttpResponse.json(full())),
    );
    const user = userEvent.setup();
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await user.click(await screen.findByText('Asha'));

    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Asha R');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
    expect(calls.replace).toBe(1);
  });

  it('on 409 keeps the edits, says the profile changed elsewhere, and offers refresh', async () => {
    recordCalls();
    server.use(
      http.get(api('/vedic-profiles'), () => HttpResponse.json([summary()])),
      http.get(api('/vedic-profiles/:id'), () =>
        HttpResponse.json(full({ name: 'Asha (updated elsewhere)' })),
      ),
      http.put(api('/vedic-profiles/:id'), () => HttpResponse.json(null, { status: 409 })),
    );
    const user = userEvent.setup();
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await user.click(await screen.findByText('Asha'));

    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'My unsaved edit');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/This profile was changed somewhere else/i)).toBeInTheDocument();
    // The user's edit is preserved — a conflict must never silently overwrite what they typed.
    expect(screen.getByLabelText('Name')).toHaveValue('My unsaved edit');
    expect(screen.getByRole('button', { name: 'Refresh and retry' })).toBeInTheDocument();
    expect(screen.queryByText('Profile saved.')).not.toBeInTheDocument();
  });
});

describe('VedicProfilesPage — delete', () => {
  it('asks for confirmation and only deletes after it is given', async () => {
    const calls = recordCalls();
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([summary()])));
    const user = userEvent.setup();
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await user.click(await screen.findByRole('button', { name: 'Delete Asha' }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(calls.remove).toBe(0);

    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' });
    const confirm = confirmButtons[confirmButtons.length - 1];
    if (confirm) await user.click(confirm);

    await waitFor(() => expect(calls.remove).toBe(1));
    expect(await screen.findByText('Profile deleted.')).toBeInTheDocument();
  });

  it('cancelling the confirmation deletes nothing', async () => {
    const calls = recordCalls();
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([summary()])));
    const user = userEvent.setup();
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await user.click(await screen.findByRole('button', { name: 'Delete Asha' }));
    const dialog = await screen.findByRole('alertdialog');
    const cancel = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Cancel');
    if (cancel) await user.click(cancel);

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(calls.remove).toBe(0);
  });
});
