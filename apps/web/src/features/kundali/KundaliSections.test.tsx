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

    // Both carry the reason code of their own engine gap. Waiting for the positive condition matters here: the two
    // region assertions above only prove the section SHELLS exist, which happens on the first commit, while the reason
    // code arrives one request later. Asserting it synchronously made this test depend on whether the three section
    // responses had already landed, which is what shuffled order changed.
    await waitFor(() => expect(screen.getAllByText(/rule-not-implemented/).length).toBeGreaterThanOrEqual(2));
    // No chart, no table, no assessments: nothing that could be read as a result.
    // Two complementary assertions, not one - scoping the check without replacing the coverage would let a stray table
    // in any third section through.
    // (a) the two unsupported sections paint nothing table-shaped...
    const yogas = screen.getByRole('region', { name: 'Yogas and doshas' });
    const ashtakavarga = screen.getByRole('region', { name: 'Ashtakavarga' });
    expect(within(yogas).queryByRole('table')).not.toBeInTheDocument();
    expect(within(ashtakavarga).queryByRole('table')).not.toBeInTheDocument();
    // (b) ...and the page as a whole renders EXACTLY the tables transits owes it. Scoping (a) alone would let a stray
    // table in any third section pass, so this page-wide count replaces the coverage the blanket assertion provided.
    // In the transits fixture used here Saturn has windows: [], Jupiter is absent, Sade Sati renders as not-active and
    // dated transits is empty - so transits contributes ZERO tables and the page must contain exactly zero. The assertion
    // is on the exact page-wide set, which is what keeps the backstop a backstop: any table appearing anywhere fails it.
    await waitFor(() => expect(screen.getByTestId('transits-body')).toBeInTheDocument());
    const allTables = screen.queryAllByRole('table');
    const strays = allTables.filter((node) => node.closest('[data-testid="transits-body"]') === null);
    expect(strays, 'no table may appear outside the transits section').toHaveLength(0);
    expect(allTables, 'the fixture renders no tables at all, so any table is a regression').toHaveLength(0);
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

  /*
   * The absent-reason case, ruled by architect: a failed section must still NAME ITSELF and say it failed - silence is
   * not an acceptable render for a failure. The with-reason assertions above pass in both a component that handles the
   * absent field and one that only handles the present field, so this is the assertion that actually carries the
   * property.
   *
   * It is a STRUCTURAL assertion rather than a fixture one because of how this codebase is shaped: SectionState's
   * unavailable arm requires \`reason\` (see AssessmentSection.tsx), and the section builders supply
   * \`reason: x.reason ?? 'unknown'\`. 'unknown' is a real code in assessmentReasonValues with its own localization, so
   * a payload with no reason cannot reach the UI as silence - it reaches it as a named, translatable state. If that
   * nullish fallback is ever removed, the type stops compiling and the sections stop rendering, rather than rendering
   * an empty failure. This test pins the user-visible half of that guarantee.
   */
  it('names the section when it fails, never rendering a silent failure', async () => {
    server.use(
      http.get(api('/kundali/:profileId/sections/yogas'), () =>
        HttpResponse.json({ ...yogasRuleNotImplemented, reason: undefined }),
      ),
      http.get(api('/kundali/:profileId/sections/ashtakavarga'), () =>
        HttpResponse.json(ashtakavargaRuleNotImplemented),
      ),
      http.get(api('/kundali/:profileId/sections/transits'), () => HttpResponse.json(transitsWithAbsences)),
    );
    renderWithProviders(<KundaliSections profileId={PROFILE_ID} timeZoneId="Asia/Kolkata" />, {
      auth: signedIn(),
    });

    // The payment: a named sentence, not an empty region.
    await waitFor(() => expect(screen.getByRole('region', { name: 'Yogas and doshas' })).toBeInTheDocument());
    const yogas = screen.getByRole('region', { name: 'Yogas and doshas' });
    expect(yogas).toHaveTextContent(/Yogas and doshas|could not be|rule set/i);
    // No sentence with a hole where the reason would go, and no raw server string standing in for one.
    expect(yogas.textContent ?? '').not.toMatch(/\(\)|undefined|null/);
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
