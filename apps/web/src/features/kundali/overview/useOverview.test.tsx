import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../../shared/auth';
import { TEST_API_BASE_URL } from '../../../test/msw/handlers';
import { server } from '../../../test/msw/server';
import { renderWithProviders } from '../../../test/render';
import { overviewComplete } from './fixtures';
import { useOverview } from './useOverview';

const api = (path: string) => `${TEST_API_BASE_URL}/api/v1${path}`;
const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Asha' } });

/** Exposes the hook's state as text so assertions can be made without reaching into query internals. */
function Probe({ profileId }: { profileId: string | null }) {
  const { status, overview, errorKind } = useOverview(profileId);
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="error">{errorKind ?? ''}</span>
      <span data-testid="name">{overview?.birthDetails.name ?? ''}</span>
    </div>
  );
}

describe('useOverview', () => {
  it('returns the server payload untouched', async () => {
    server.use(http.get(api(`/kundali/${PROFILE_ID}/overview`), () => HttpResponse.json(overviewComplete)));
    renderWithProviders(<Probe profileId={PROFILE_ID} />, { auth: signedIn() });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('name')).toHaveTextContent('Asha');
  });

  it('requests the profile id in the path', async () => {
    let seen: string | null = null;
    server.use(
      http.get(api('/kundali/:profileId/overview'), ({ params }) => {
        seen = params.profileId as string;
        return HttpResponse.json(overviewComplete);
      }),
    );
    renderWithProviders(<Probe profileId={PROFILE_ID} />, { auth: signedIn() });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(seen).toBe(PROFILE_ID);
  });

  it('surfaces a 404 as an error kind rather than an empty overview', async () => {
    // A foreign or deleted profile must not render as a page with no data.
    server.use(
      http.get(api(`/kundali/${PROFILE_ID}/overview`), () => HttpResponse.json(null, { status: 404 })),
    );
    renderWithProviders(<Probe profileId={PROFILE_ID} />, { auth: signedIn() });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
    expect(screen.getByTestId('error')).toHaveTextContent('notFound');
    expect(screen.getByTestId('name')).toHaveTextContent('');
  });

  it('surfaces 503 as an error kind, distinct from 404', async () => {
    server.use(
      http.get(api(`/kundali/${PROFILE_ID}/overview`), () => HttpResponse.json(null, { status: 503 })),
    );
    renderWithProviders(<Probe profileId={PROFILE_ID} />, { auth: signedIn() });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
    expect(screen.getByTestId('error')).not.toHaveTextContent('notFound');
  });

  it('does not request anything when no profile is selected', async () => {
    let calls = 0;
    server.use(
      http.get(api('/kundali/:profileId/overview'), () => {
        calls += 1;
        return HttpResponse.json(overviewComplete);
      }),
    );
    renderWithProviders(<Probe profileId={null} />, { auth: signedIn() });

    // Give any stray request a chance to fire before asserting none did.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toBe(0);
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
  });
});
