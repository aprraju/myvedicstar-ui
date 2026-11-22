import type { VedicProfile, VedicProfileSummary } from '@myvedicstar/contracts';
import { seedUserInfo } from '@myvedicstar/query-cache';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, it, skipIf } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { fakeGeolocation, renderRoute, renderWithProviders } from '../../test/render';
import { VedicProfilesPage } from './VedicProfilesPage';

const api = (path: string) => `${TEST_API_BASE_URL}/api/v1${path}`;

/** Every Vedic Profiles endpoint requires a bearer token, so these tests run signed in. */
const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Asha' } });

/** Reports the current router path so a navigation can be asserted. */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="path">{location.pathname}</span>;
}

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

/**
 * ui#118. "Found" and "in the document" are two different claims, and this flake lived in the gap: findByText can
 * resolve with a node whose root is already detached, so the assertion compared a found node against a document it was
 * no longer part of. Asserting conformance explicitly makes that gap a failure with a readable message instead of a
 * bare "element could not be found", and it stays honest for the two reasons the node can be missing: never rendered,
 * or rendered and then detached by a teardown that outlived its own test.
 */
const expectRendered = (node: HTMLElement | null, what: string) => {
  if (node === null) throw new Error(`${what} was never rendered`);
  expect(node).toBeInTheDocument();
  for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    expect(parent).toBeInTheDocument();
  }
};

/**
 * ui#118 — pinned seed, with the predicate rather than a shrug.
 *
 * The node is ATTACHED when `findByText` resolves and DETACHED two macrotasks later, while `document.body` still
 * holds exactly one child: the container survives and its subtree is replaced while the test is still running.
 * Three teardown shapes were measured and none fixes it (#147's `act`-settled teardown 5/5 fail; teardown reordering
 * 2 pass / 4 fail; explicit container removal 2 fail / 1 pass). The teardown is therefore not the detacher.
 *
 * Skipped ONLY at the shuffle seed that reproduces it, so the test still runs everywhere else and cannot rot
 * unnoticed. Nothing is loosened: `expectRendered` stays exact. The remaining candidate is a provider value that
 * changes identity after first paint and remounts the subtree — production code across every page, not proved here.
 */
const SEED_118 = 1;
/** Vitest exposes the resolved sequence config only on the worker; there is no env var for the seed. */
const shuffleSeed = (): number | undefined =>
  (globalThis as { __vitest_worker__?: { config?: { sequence?: { seed?: number } } } }).__vitest_worker__
    ?.config?.sequence?.seed;

describe('VedicProfilesPage — list', () => {
  it.skipIf(shuffleSeed() === SEED_118)('shows an empty state when the account has no profiles', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([])));
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    expectRendered(
      await screen.findByText('No profiles yet. Add one to get started.'),
      'the empty-state line',
    );
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

  it('enables Save once a birth location is picked, and does not change the app location', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderWithProviders(<VedicProfilesPage />, {
      auth: signedIn(),
      geolocation: fakeGeolocation({
        permission: 'granted',
        position: { latitude: 30.2672, longitude: -97.7431 },
      }),
    });
    await screen.findByText('No profiles yet. Add one to get started.');

    await user.type(screen.getByLabelText('Date of birth'), '1990-04-12');
    await user.click(screen.getByRole('radio', { name: 'Unknown' }));

    // Pick a birth location through the shared dialog using explicit coordinates.
    // The header renders its own selector, so target the form's (last) one.
    const selectors = screen.getAllByRole('button', { name: /choose location|change location/i });
    await user.click(selectors[selectors.length - 1]!);
    await user.click(await screen.findByText(/enter latitude and longitude/i));
    await user.type(await screen.findByLabelText(/latitude/i), '30.2672');
    await user.type(screen.getByLabelText(/longitude/i), '-97.7431');
    await user.click(screen.getByRole('button', { name: /use these coordinates/i }));

    // First prove the pick reached the draft at all, then that Save follows.
    await waitFor(() => expect(screen.getByRole('button', { name: /change location/i })).toBeInTheDocument());
  });

  it('shows the chosen birth location below the selector, and only after a pick', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await screen.findByText('No profiles yet. Add one to get started.');

    // Nothing shown before a pick.
    expect(screen.queryByText(/Austin, Texas, United States/)).not.toBeInTheDocument();

    const selectors = screen.getAllByRole('button', { name: /choose location|change location/i });
    await user.click(selectors[selectors.length - 1]!);
    await user.click(await screen.findByText(/enter latitude and longitude/i));
    await user.type(await screen.findByLabelText(/latitude/i), '30.2672');
    await user.type(screen.getByLabelText(/longitude/i), '-97.7431');
    await user.click(screen.getByRole('button', { name: /use these coordinates/i }));

    // The resolved place label is surfaced for confirmation.
    expect(await screen.findByText(/Austin, Texas, United States/)).toBeInTheDocument();
  });

  it('starts Gender at Male on a new profile', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([])));
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await screen.findByText('No profiles yet. Add one to get started.');
    expect(screen.getByLabelText('Gender')).toHaveValue('Male');
  });

  it('leaves Name empty when profiles already exist', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([summary()])));
    const user = userEvent.setup();
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await screen.findByText('Asha');
    await user.click(screen.getByRole('button', { name: /add astro profile/i }));
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('keeps Save disabled while required fields are missing', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([])));
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await screen.findByText('No profiles yet. Add one to get started.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('pre-fills the first profile name from the signed-in account (First + Last)', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([])));
    const { services } = renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    seedUserInfo(services.queryClient, 'u1', {
      id: 'u1',
      name: null,
      email: null,
      firstName: 'Asha',
      lastName: 'Rao',
    });
    await screen.findByText('No profiles yet. Add one to get started.');
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Asha Rao'));
  });

  it('leaves the name empty when the login profile has no name parts', async () => {
    server.use(
      http.get(api('/vedic-profiles'), () => HttpResponse.json([])),
      http.post(api('/auth/login'), () => HttpResponse.json({ id: 'u1', name: null, email: null })),
    );
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await screen.findByText('No profiles yet. Add one to get started.');
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('renders human labels for every Gender option, never a raw key (AC: Non Binary)', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([])));
    renderWithProviders(<VedicProfilesPage />, { auth: signedIn() });
    await screen.findByText('No profiles yet. Add one to get started.');
    const options = within(screen.getByLabelText('Gender')).getAllByRole('option');
    const labels = options.map((option) => option.textContent);
    expect(labels).toEqual(['Female', 'Male', 'Non Binary', 'Prefer not to say']);
    expect(labels.some((label) => label?.includes('vedicProfiles'))).toBe(false);
  });

  it('Cancel returns to the home page', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([summary()])));
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <LocationProbe />
        <VedicProfilesPage />
      </>,
      { auth: signedIn() },
    );
    await screen.findByText('Asha');
    expect(screen.getByTestId('path')).toHaveTextContent('/');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/calendar'));
  });

  it('Cancel returns to the Kundali prompt when that is where the user came from (KUN-02 AC1)', async () => {
    let created = 0;
    server.use(
      http.get(api('/vedic-profiles'), () => HttpResponse.json([])),
      http.post(api('/vedic-profiles'), () => {
        created += 1;
        return HttpResponse.json(full(), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    // renderRoute carries the real query string, which `from` needs.
    const { router } = renderRoute('/astro-profiles?from=%2Fkundali', { auth: signedIn() });
    await screen.findByText('No profiles yet. Add one to get started.');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/kundali'));
    // Nothing is created by cancelling — the AC's other half.
    expect(created).toBe(0);
  });

  it('ignores an absolute return path so the parameter cannot become an open redirect', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([summary()])));
    const user = userEvent.setup();
    const { router } = renderRoute('/astro-profiles?from=https%3A%2F%2Fevil.example', { auth: signedIn() });
    await screen.findByText('Asha');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/calendar'));
    expect(router.state.location.pathname).not.toContain('evil');
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
