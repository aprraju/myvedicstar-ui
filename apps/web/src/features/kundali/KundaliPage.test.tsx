import type { VedicProfileSummary } from '@myvedicstar/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute } from '../../test/render';

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

const SECOND_ID = '22222222-2222-4222-8222-222222222222';
const FOREIGN_ID = '99999999-9999-4999-8999-999999999999';

/**
 * The real route table at a URL. A bare <KundaliPage /> has no route context, so the profile id in the query string —
 * which is the whole point of KUN-01 — cannot be exercised; renderRoute gives the page its real router.
 */
const renderKundali = (url = '/kundali') => renderRoute(url, { auth: signedIn() });

describe('KundaliPage — shell', () => {
  it('renders the route shell with the Kundali title', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([summary()])));
    renderKundali();

    expect(await screen.findByRole('heading', { level: 1, name: 'Kundali' })).toBeInTheDocument();
  });

  it('shows a loading status while the list request is in flight', async () => {
    server.use(http.get(api('/vedic-profiles'), () => new Promise(() => undefined)));
    renderKundali();

    // The router's lazy fallback also carries role="status"; wait for the page's own status text.
    expect(await screen.findByText('Loading profiles…')).toBeInTheDocument();
  });

  it('lists only the profiles the server returned in the selector', async () => {
    server.use(
      http.get(api('/vedic-profiles'), () =>
        HttpResponse.json([summary(), summary({ id: SECOND_ID, name: 'Ravi', relationship: 'Son' })]),
      ),
    );
    renderKundali();

    const select = await screen.findByLabelText('Astro Profile');
    // Placeholder while nothing is selected, plus the two rows the server returned.
    await waitFor(() => expect(select.querySelectorAll('option')).toHaveLength(3));
    expect(screen.getByRole('option', { name: 'Asha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ravi' })).toBeInTheDocument();
  });

  it('selects a profile and shows its Kundali heading', async () => {
    server.use(
      http.get(api('/vedic-profiles'), () =>
        HttpResponse.json([summary(), summary({ id: SECOND_ID, name: 'Ravi', relationship: 'Son' })]),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderKundali();

    const select = await screen.findByLabelText('Astro Profile');
    await user.selectOptions(select, SECOND_ID);

    expect(await screen.findByRole('heading', { name: 'Kundali for Ravi' })).toBeInTheDocument();
    // Selection lives in the URL, not in hidden component state.
    await waitFor(() => expect(router.state.location.search).toContain(`profile=${SECOND_ID}`));
  });

  it('does not flash the unavailable state while the list is still loading', async () => {
    server.use(http.get(api('/vedic-profiles'), () => new Promise(() => undefined)));
    renderKundali(`/kundali?profile=${SECOND_ID}`);

    expect(await screen.findByText('Loading profiles…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'This profile is not available' })).not.toBeInTheDocument();
  });
});

describe('KundaliPage — ownership (KUN-01)', () => {
  it('shows the unavailable state for a profile id that is not in the owned list', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([summary()])));
    renderKundali(`/kundali?profile=${FOREIGN_ID}`);

    expect(await screen.findByRole('heading', { name: 'This profile is not available' })).toBeInTheDocument();
    // The offending id must never be echoed back into the page.
    expect(screen.queryByText(/99999999/)).not.toBeInTheDocument();
  });

  it('recovers from the unavailable state by selecting an owned profile', async () => {
    server.use(
      http.get(api('/vedic-profiles'), () =>
        HttpResponse.json([summary(), summary({ id: SECOND_ID, name: 'Ravi', relationship: 'Son' })]),
      ),
    );
    const user = userEvent.setup();
    renderKundali(`/kundali?profile=${FOREIGN_ID}`);

    await screen.findByRole('heading', { name: 'This profile is not available' });
    await user.click(screen.getByRole('button', { name: 'Choose another profile' }));

    expect(await screen.findByRole('heading', { name: 'Kundali for Asha' })).toBeInTheDocument();
  });
});

describe('KundaliPage — zero profile guidance (KUN-02)', () => {
  it('guides the user to create their first Astro Profile when the list is empty', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json([])));
    renderKundali();

    expect(
      await screen.findByRole('heading', { name: 'Create your first Astro Profile' }),
    ).toBeInTheDocument();
    // Reuses the existing create flow and carries the return path back to Kundali.
    expect(screen.getByRole('link', { name: 'Create Astro Profile' })).toHaveAttribute(
      'href',
      '/astro-profiles?from=%2Fkundali',
    );
    expect(screen.getByText('Cancel returns to where you were and creates nothing.')).toBeInTheDocument();
  });

  it('shows an error with retry instead of the zero-profile prompt when the list request fails', async () => {
    server.use(http.get(api('/vedic-profiles'), () => HttpResponse.json(null, { status: 500 })));
    renderKundali();

    expect(await screen.findByRole('heading', { name: 'Profiles could not be loaded' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Create your first Astro Profile' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('retries the list after a failure and then shows the profiles', async () => {
    let attempt = 0;
    server.use(
      http.get(api('/vedic-profiles'), () => {
        attempt += 1;
        return attempt === 1 ? HttpResponse.json(null, { status: 500 }) : HttpResponse.json([summary()]);
      }),
    );
    const user = userEvent.setup();
    renderKundali();

    await screen.findByRole('heading', { name: 'Profiles could not be loaded' });
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText('Astro Profile')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Create your first Astro Profile' }),
    ).not.toBeInTheDocument();
  });
});
