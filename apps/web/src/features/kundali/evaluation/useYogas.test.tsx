import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../../shared/auth';
import { TEST_API_BASE_URL } from '../../../test/msw/handlers';
import { server } from '../../../test/msw/server';
import { renderWithProviders } from '../../../test/render';
import { ashtakavargaComputed } from '../ashtakavarga/fixtures';
import { useAshtakavarga } from '../ashtakavarga/useAshtakavarga';
import { yogasComputed, yogasRuleNotImplemented } from '../yogas/fixtures';
import { useYogas } from '../yogas/useYogas';

const api = (path: string) => `${TEST_API_BASE_URL}/api/v1${path}`;
const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Asha' } });

function Probe({ profileId }: { profileId: string | null }) {
  const yogas = useYogas(profileId);
  const ashtakavarga = useAshtakavarga(profileId);
  return (
    <div>
      <span data-testid="yogas-status">{yogas.status}</span>
      <span data-testid="yogas-availability">{yogas.yogas?.availability ?? ''}</span>
      <span data-testid="yogas-error">{yogas.errorKind ?? ''}</span>
      <span data-testid="ashtakavarga-status">{ashtakavarga.status}</span>
      <span data-testid="ashtakavarga-availability">{ashtakavarga.ashtakavarga?.availability ?? ''}</span>
      <span data-testid="ashtakavarga-error">{ashtakavarga.errorKind ?? ''}</span>
    </div>
  );
}

describe('useYogas / useAshtakavarga', () => {
  it('returns the server payloads untouched', async () => {
    server.use(
      http.get(api(`/kundali/${PROFILE_ID}/sections/yogas`), () => HttpResponse.json(yogasComputed)),
      http.get(api(`/kundali/${PROFILE_ID}/sections/ashtakavarga`), () =>
        HttpResponse.json(ashtakavargaComputed),
      ),
    );
    renderWithProviders(<Probe profileId={PROFILE_ID} />, { auth: signedIn() });

    await waitFor(() => expect(screen.getByTestId('yogas-status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('yogas-availability')).toHaveTextContent('computed');
    expect(screen.getByTestId('ashtakavarga-availability')).toHaveTextContent('computed');
  });

  it('treats an unsupported payload as a successful response, not an error', async () => {
    server.use(
      http.get(api(`/kundali/${PROFILE_ID}/sections/yogas`), () =>
        HttpResponse.json(yogasRuleNotImplemented),
      ),
      http.get(api(`/kundali/${PROFILE_ID}/sections/ashtakavarga`), () =>
        HttpResponse.json({ availability: 'unsupported', reason: 'rule-not-implemented' }),
      ),
    );
    renderWithProviders(<Probe profileId={PROFILE_ID} />, { auth: signedIn() });

    await waitFor(() => expect(screen.getByTestId('yogas-status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('yogas-availability')).toHaveTextContent('unsupported');
    expect(screen.getByTestId('yogas-error')).toHaveTextContent('');
    expect(screen.getByTestId('ashtakavarga-availability')).toHaveTextContent('unsupported');
  });

  it('surfaces a 404 as an error kind rather than an empty section', async () => {
    server.use(
      http.get(api(`/kundali/${PROFILE_ID}/sections/yogas`), () => HttpResponse.json(null, { status: 404 })),
      http.get(api(`/kundali/${PROFILE_ID}/sections/ashtakavarga`), () =>
        HttpResponse.json(null, { status: 404 }),
      ),
    );
    renderWithProviders(<Probe profileId={PROFILE_ID} />, { auth: signedIn() });

    await waitFor(() => expect(screen.getByTestId('yogas-status')).toHaveTextContent('error'));
    expect(screen.getByTestId('yogas-error')).toHaveTextContent('notFound');
    expect(screen.getByTestId('yogas-availability')).toHaveTextContent('');
  });

  it('rejects an ashtakavarga payload that does not reconcile, as an error rather than a chart', async () => {
    // The server claims a sarva total that the bhinna rows do not add up to. That is a calculation error, and the
    // client must refuse it: charting inconsistent numbers publishes a wrong answer.
    server.use(
      http.get(api(`/kundali/${PROFILE_ID}/sections/yogas`), () =>
        HttpResponse.json(yogasRuleNotImplemented),
      ),
      http.get(api(`/kundali/${PROFILE_ID}/sections/ashtakavarga`), () =>
        HttpResponse.json({ ...ashtakavargaComputed, sarva: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }),
      ),
    );
    renderWithProviders(<Probe profileId={PROFILE_ID} />, { auth: signedIn() });

    await waitFor(() => expect(screen.getByTestId('ashtakavarga-status')).toHaveTextContent('error'));
    expect(screen.getByTestId('ashtakavarga-availability')).toHaveTextContent('');
  });

  it('does not request anything when no profile is selected', async () => {
    let calls = 0;
    server.use(
      http.get(api('/kundali/:profileId/sections/:section'), () => {
        calls += 1;
        return HttpResponse.json(yogasRuleNotImplemented);
      }),
    );
    renderWithProviders(<Probe profileId={null} />, { auth: signedIn() });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toBe(0);
    expect(screen.getByTestId('yogas-status')).toHaveTextContent('loading');
  });
});
