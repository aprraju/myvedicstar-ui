import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../../shared/auth';
import { TEST_API_BASE_URL } from '../../../test/msw/handlers';
import { server } from '../../../test/msw/server';
import { renderWithProviders } from '../../../test/render';
import { ashtakavargaRuleNotImplemented } from '../ashtakavarga/fixtures';
import { KundaliSections } from '../KundaliSections';
import { remediesEvaluated } from '../remedies/fixtures';
import { transitsWithAbsences } from '../transits/fixtures';
import { yogasRuleNotImplemented } from '../yogas/fixtures';
import { varshaphalCapabilityGap, varshaphalComputed } from './fixtures';

/**
 * ui#123 acceptance: **the Varshaphal shell must never fabricate a chart when the capability is absent.**
 *
 * This is the test that would fail if the annual chart were ever derived client-side. Two independent fences:
 *
 *  1. a payload the API could not have produced (a chart beside `unsupported`, or the free-form "facts" bag the existing
 *     endpoint returns) must fail to parse, so the section renders the error state and NO chart;
 *  2. on the day-one gap payload, the rendered section contains no table, no placeholder rows and no numeric cells — only
 *     the reason statement.
 *
 * Both are asserted through the real page, not the component in isolation, because the failure mode being guarded against
 * is a section that quietly synthesises values while its own unit test still passes.
 */

const api = (path: string) => `${TEST_API_BASE_URL}/api/v1${path}`;
const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Asha' } });

/** Every other section stays in its day-one unsupported shape, so the only variable is the annual chart. */
function stubOtherSections() {
  server.use(
    http.get(api('/kundali/:profileId/sections/yogas'), () => HttpResponse.json(yogasRuleNotImplemented)),
    http.get(api('/kundali/:profileId/sections/ashtakavarga'), () =>
      HttpResponse.json(ashtakavargaRuleNotImplemented),
    ),
    http.get(api('/kundali/:profileId/sections/transits'), () => HttpResponse.json(transitsWithAbsences)),
    http.get(api('/kundali/:profileId/sections/remedies'), () => HttpResponse.json(remediesEvaluated)),
  );
}

const varshaphalRegion = () => screen.getByRole('region', { name: 'Annual chart (Varshaphal)' });

describe('Varshaphal — the gap is rendered as a gap, never as an empty or invented chart', () => {
  it('renders the capability gap with the server reason, and paints no table at all', async () => {
    stubOtherSections();
    server.use(
      http.get(api('/kundali/:profileId/sections/varshaphal'), () =>
        HttpResponse.json(varshaphalCapabilityGap),
      ),
    );
    renderWithProviders(<KundaliSections profileId={PROFILE_ID} timeZoneId="Asia/Kolkata" />, {
      auth: signedIn(),
    });

    // Wait on the positive condition: the reason code arrives with the payload, not with the shell.
    await waitFor(() => expect(within(varshaphalRegion()).getByText(/not available/i)).toBeInTheDocument());
    // The reason is rendered as its catalog sentence (the code is never shown to a user); the code itself is carried on
    // the element so the state is inspectable without exposing vocabulary the user was never meant to read.
    expect(
      within(varshaphalRegion()).getByText(/calculation service did not return this/i),
    ).toBeInTheDocument();
    expect(varshaphalRegion().querySelector('[data-varshaphal-state="capability-gap"]')).not.toBeNull();

    // The heart of the test: nothing chart-shaped, and nothing number-shaped, exists in the section.
    expect(within(varshaphalRegion()).queryByRole('table')).not.toBeInTheDocument();
    expect(within(varshaphalRegion()).queryByRole('columnheader')).not.toBeInTheDocument();
    expect(within(varshaphalRegion()).queryByRole('row')).not.toBeInTheDocument();
    // An annual year rendered as 0, or a longitude as 00°00', would be the fabrication this section forbids.
    expect(within(varshaphalRegion()).queryByText(/\b\d{4}\b/)).not.toBeInTheDocument();
    expect(within(varshaphalRegion()).queryByText(/°|\b0\b/)).not.toBeInTheDocument();
  });

  it('refuses a payload that carries a chart beside an unsupported availability', async () => {
    stubOtherSections();
    server.use(
      http.get(api('/kundali/:profileId/sections/varshaphal'), () =>
        HttpResponse.json({
          ...varshaphalCapabilityGap,
          // Deliberately the wrong shape for this availability: exactly what a server bug (or a client-side "helpful"
          // merge) would produce. The cast is only to get it past TypeScript so the RUNTIME refusal is what is tested.
          chart: varshaphalComputed.availability === 'computed' ? varshaphalComputed.chart : undefined,
        }),
      ),
    );
    renderWithProviders(<KundaliSections profileId={PROFILE_ID} timeZoneId="Asia/Kolkata" />, {
      auth: signedIn(),
    });

    // A schema rejection is an error the user can retry, not a chart. The section reports a load failure and stays empty.
    await waitFor(() =>
      expect(within(varshaphalRegion()).getByRole('button', { name: /try again/i })).toBeInTheDocument(),
    );
    expect(within(varshaphalRegion()).queryByRole('table')).not.toBeInTheDocument();
    // The fabricated value must not appear anywhere on the page, not merely outside the table.
    expect(screen.queryByText(/Mesha 11°24'/)).not.toBeInTheDocument();
  });

  it('refuses the free-form "annual chart facts" bag the current endpoint returns', async () => {
    stubOtherSections();
    server.use(
      http.get(api('/kundali/:profileId/sections/varshaphal'), () =>
        HttpResponse.json({ availability: 'computed', chart: { facts: { lagna: 'Mesha', year: '2083' } } }),
      ),
    );
    renderWithProviders(<KundaliSections profileId={PROFILE_ID} timeZoneId="Asia/Kolkata" />, {
      auth: signedIn(),
    });

    await waitFor(() =>
      expect(within(varshaphalRegion()).getByRole('button', { name: /try again/i })).toBeInTheDocument(),
    );
    expect(within(varshaphalRegion()).queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/Mesha/)).not.toBeInTheDocument();
  });

  it('draws a chart only when the payload says computed, and shows withheld values with their reason', async () => {
    // The complement case. Without this, a component that rendered nothing ever would pass the three tests above.
    stubOtherSections();
    server.use(
      http.get(api('/kundali/:profileId/sections/varshaphal'), () => HttpResponse.json(varshaphalComputed)),
    );
    renderWithProviders(<KundaliSections profileId={PROFILE_ID} timeZoneId="Asia/Kolkata" />, {
      auth: signedIn(),
    });

    await waitFor(() => expect(within(varshaphalRegion()).getByRole('table')).toBeInTheDocument());
    expect(within(varshaphalRegion()).getByText("Simha 4°02'")).toBeInTheDocument();
    // A withheld annual value is stated, not omitted: the row exists with its reason code.
    expect(within(varshaphalRegion()).getByText(/varshaphal\/annual\/lagna-minute/)).toBeInTheDocument();
  });
});
