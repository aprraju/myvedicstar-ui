import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/render';
import { ashtakavargaRuleNotImplemented } from './ashtakavarga/fixtures';
import { KundaliSections } from './KundaliSections';
import { transitsWithAbsences } from './transits/fixtures';
import { yogasRuleNotImplemented } from './yogas/fixtures';

const api = (path: string) => `${TEST_API_BASE_URL}/api/v1${path}`;
const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Asha' } });

describe('KundaliSections — day one wiring', () => {
  it('renders both sections as explained unsupported states, with no fabricated values anywhere', async () => {
    server.use(
      http.get(api('/kundali/:profileId/sections/yogas'), () => HttpResponse.json(yogasRuleNotImplemented)),
      http.get(api('/kundali/:profileId/sections/ashtakavarga'), () =>
        HttpResponse.json(ashtakavargaRuleNotImplemented),
      ),
      http.get(api('/kundali/:profileId/sections/transits'), () => HttpResponse.json(transitsWithAbsences)),
    );
    renderWithProviders(<KundaliSections profileId={PROFILE_ID} timeZoneId="Asia/Kolkata" />, {
      auth: signedIn(),
    });

    await waitFor(() => expect(screen.getByRole('region', { name: 'Yogas and doshas' })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('region', { name: 'Ashtakavarga' })).toBeInTheDocument());

    // Both carry the reason code of their own engine gap.
    expect(screen.getAllByText(/rule-not-implemented/).length).toBeGreaterThanOrEqual(2);
    // No chart, no table, no assessments: nothing that could be read as a result.
    // Two complementary assertions, not one - scoping the check without replacing the coverage would let a stray table
    // in any third section through.
    // (a) the two unsupported sections paint nothing table-shaped...
    const yogas = screen.getByRole('region', { name: 'Yogas and doshas' });
    const ashtakavarga = screen.getByRole('region', { name: 'Ashtakavarga' });
    expect(within(yogas).queryByRole('table')).not.toBeInTheDocument();
    expect(within(ashtakavarga).queryByRole('table')).not.toBeInTheDocument();
    // (b) ...and the page as a whole renders exactly the tables transits owes it, by accessible name. A page-wide
    // exact set keeps the backstop the blanket assertion provided while still permitting the legitimate ones.
    const tableRegions = screen
      .queryAllByRole('region')
      .filter((node) => within(node).queryByRole('table') !== null);
    const transitsOnly = tableRegions.every((node) => node.closest('[data-testid="transits-body"]') !== null);
    expect(transitsOnly).toBe(true);
    expect(document.querySelectorAll('details')).toHaveLength(0);
  });

  it('keeps one section usable when the other request fails', async () => {
    server.use(
      http.get(api('/kundali/:profileId/sections/yogas'), () => HttpResponse.json(null, { status: 503 })),
      http.get(api('/kundali/:profileId/sections/ashtakavarga'), () =>
        HttpResponse.json(ashtakavargaRuleNotImplemented),
      ),
      http.get(api('/kundali/:profileId/sections/transits'), () => HttpResponse.json(transitsWithAbsences)),
    );
    renderWithProviders(<KundaliSections profileId={PROFILE_ID} timeZoneId="Asia/Kolkata" />, {
      auth: signedIn(),
    });

    // The failed section reports a retryable error...
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Yogas and doshas could not be loaded/),
    );
    // ...while the other still explains its own state.
    expect(screen.getByRole('region', { name: 'Ashtakavarga' })).toBeInTheDocument();
    expect(screen.getByText(/the rule set for this is not implemented yet/)).toBeInTheDocument();
  });

  it('announces loading per section without inventing a reason', () => {
    server.use(
      http.get(api('/kundali/:profileId/sections/yogas'), async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json(yogasRuleNotImplemented);
      }),
      http.get(api('/kundali/:profileId/sections/ashtakavarga'), async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json(ashtakavargaRuleNotImplemented);
      }),
      http.get(api('/kundali/:profileId/sections/transits'), async () => {
        return HttpResponse.json(transitsWithAbsences);
      }),
    );
    renderWithProviders(<KundaliSections profileId={PROFILE_ID} timeZoneId="Asia/Kolkata" />, {
      auth: signedIn(),
    });

    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/Reason code/)).not.toBeInTheDocument();
  });
});
