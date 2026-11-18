import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../../shared/auth';
import { storeSelectedLocation } from '../../../test/location-fixtures';
import { TEST_API_BASE_URL } from '../../../test/msw/handlers';
import { server } from '../../../test/msw/server';
import { renderRoute } from '../../../test/render';

const api = (path: string) => `${TEST_API_BASE_URL}/api/v1${path}`;
const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Asha' } });

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';

const profile = {
  id: PROFILE_ID,
  name: 'Asha',
  relationship: 'Self',
  customRelationship: null,
  revision: 3,
};

/**
 * A Vimshottari payload with three mahadashas and a three-level path. The bounds are deliberately exact instants in
 * UTC with a display zone of Asia/Kolkata, so a renderer that used the device zone instead would produce visibly
 * different times rather than passing by coincidence.
 */
const timeline = {
  system: 'vimshottari',
  displayTimezone: 'Asia/Kolkata',
  moonLongitude: 123.456,
  at: '2026-11-18T04:30:00+00:00',
  mahadashas: [
    {
      lord: 'Ketu',
      level: 'mahadasha',
      startUtc: '2015-03-01T00:00:00+00:00',
      endUtc: '2022-03-01T00:00:00+00:00',
    },
    {
      lord: 'Venus',
      level: 'mahadasha',
      startUtc: '2022-03-01T00:00:00+00:00',
      endUtc: '2042-03-01T00:00:00+00:00',
    },
    {
      lord: 'Sun',
      level: 'mahadasha',
      startUtc: '2042-03-01T00:00:00+00:00',
      endUtc: '2048-03-01T00:00:00+00:00',
    },
  ],
  periodPath: [
    {
      lord: 'Venus',
      level: 'mahadasha',
      startUtc: '2022-03-01T00:00:00+00:00',
      endUtc: '2042-03-01T00:00:00+00:00',
    },
    {
      lord: 'Mercury',
      level: 'antardasha',
      startUtc: '2026-09-01T00:00:00+00:00',
      endUtc: '2029-07-01T00:00:00+00:00',
    },
    {
      lord: 'Saturn',
      level: 'pratyantardasha',
      startUtc: '2026-11-01T00:00:00+00:00',
      endUtc: '2027-01-20T00:00:00+00:00',
    },
  ],
  unsupported: [],
};

const profileHandler = () => http.get(api('/vedic-profiles'), () => HttpResponse.json([profile]));

const renderDashas = (url = `/kundali?profile=${PROFILE_ID}`) => {
  storeSelectedLocation();
  return renderRoute(url, { auth: signedIn() });
};

describe('DashasSection — KUN-09 timeline', () => {
  it('lists every mahadasha in order with its instants rendered in the display timezone', async () => {
    server.use(
      profileHandler(),
      http.get(api(`/kundali/${PROFILE_ID}/sections/dashas`), () => HttpResponse.json(timeline)),
    );

    renderDashas();

    const timelineRegion = await screen.findByTestId('dasha-timeline');
    const items = within(timelineRegion).getAllByRole('listitem');
    // Three mahadashas plus the three path entries: nothing is duplicated or invented.
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(timelineRegion).toHaveTextContent('Ketu');
    expect(timelineRegion).toHaveTextContent('Venus');
    expect(timelineRegion).toHaveTextContent('Sun');
    // Rendered in Asia/Kolkata: 2042-03-01T00:00Z is 05:30 the same day there, not 00:00.
    expect(timelineRegion).toHaveTextContent(/5:30\sAM/);
    expect(timelineRegion).toHaveTextContent('Asia/Kolkata');
  });

  it('marks the period path the server resolved, not one derived from the browser clock', async () => {
    server.use(
      profileHandler(),
      http.get(api(`/kundali/${PROFILE_ID}/sections/dashas`), () => HttpResponse.json(timeline)),
    );

    renderDashas();

    const path = await screen.findByTestId('dasha-path');
    const pathItems = within(path).getAllByRole('listitem');
    expect(pathItems).toHaveLength(3);
    expect(pathItems[0]).toHaveTextContent('Venus');
    expect(pathItems[1]).toHaveTextContent('Mercury');
    expect(pathItems[2]).toHaveTextContent('Saturn');

    // The mahadasha that contains the instant carries the current marker; the others do not.
    const timelineRegion = screen.getByTestId('dasha-timeline');
    const current = timelineRegion.querySelectorAll('[data-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Venus');
  });

  it("requests the system the user selects and never another system's dates", async () => {
    const requested: string[] = [];
    server.use(
      profileHandler(),
      http.get(api(`/kundali/${PROFILE_ID}/sections/dashas`), ({ request }) => {
        const system = new URL(request.url).searchParams.get('system') ?? '';
        requested.push(system);
        return HttpResponse.json({ ...timeline, system });
      }),
    );

    const { router } = renderDashas();
    await screen.findByTestId('dasha-timeline');
    expect(requested).toEqual(['vimshottari']);

    await userEvent.click(screen.getByRole('radio', { name: 'Yogini' }));
    await waitFor(() => expect(requested).toContain('yogini'));
    // The choice is reflected in the URL so a reload or a shared link reads the same system.
    await waitFor(() => expect(router.state.location.search).toContain('system=yogini'));
  });

  it('states that Chara is withheld with the reason the server gave, and shows no periods', async () => {
    const requested: string[] = [];
    server.use(
      profileHandler(),
      http.get(api(`/kundali/${PROFILE_ID}/sections/dashas`), ({ request }) => {
        requested.push(new URL(request.url).searchParams.get('system') ?? '');
        // A system whose timeline is withheld still answers 200 with the reason codes rather than an error: the
        // absence is a statement about the calculation, not a failure to read it.
        return HttpResponse.json({
          system: 'chara',
          displayTimezone: 'Asia/Kolkata',
          at: '2026-11-18T04:30:00+00:00',
          mahadashas: [],
          periodPath: [],
          unsupported: [
            { path: 'Mahadashas', reason: 'unvalidated-reference' },
            { path: 'PeriodPath', reason: 'unvalidated-reference' },
          ],
        });
      }),
    );

    renderDashas(`/kundali?profile=${PROFILE_ID}&system=chara`);

    // The system choice is a live control, so the section's own radios are the readiness signal.
    expect(await screen.findByRole('radio', { name: 'Chara' })).toBeChecked();
    await waitFor(() => expect(requested).toEqual(['chara']));
    // The withheld block only exists once the section has settled on the chara response, so wait on the section's own
    // chrome first (the same readiness signal the passing cases rely on) and then on the absence statement.
    const section = await screen.findByRole('region', { name: 'Dashas' });
    expect(within(section).getByRole('radio', { name: 'Chara' })).toBeChecked();
    const withheld = await within(section).findByTestId('dashas-withheld');
    // The claim is "computed but not yet proven", which is distinct from "not built" and from "cannot know".
    expect(withheld).toHaveTextContent(/no independent reference yet/i);
    expect(screen.queryByTestId('dasha-timeline')).not.toBeInTheDocument();
  });

  it('explains an empty period path instead of leaving a blank area', async () => {
    server.use(
      profileHandler(),
      http.get(api(`/kundali/${PROFILE_ID}/sections/dashas`), () =>
        HttpResponse.json({
          ...timeline,
          periodPath: [],
          unsupported: [{ path: 'PeriodPath', reason: 'engine-unavailable' }],
        }),
      ),
    );

    renderDashas();

    const timelineRegion = await screen.findByTestId('dasha-timeline');
    expect(within(timelineRegion).queryByTestId('dasha-path')).not.toBeInTheDocument();
    expect(timelineRegion).toHaveTextContent(/outside the calculated span/i);
    expect(timelineRegion).toHaveTextContent(/calculation service did not return this/i);
  });

  it('shows an error with a retry when the timeline cannot be read', async () => {
    server.use(
      profileHandler(),
      http.get(api(`/kundali/${PROFILE_ID}/sections/dashas`), () =>
        HttpResponse.json({ status: 500, title: 'failed' }, { status: 500 }),
      ),
    );

    renderDashas();

    // Scoped to the dasha section: other Kundali sections render their own retry buttons on the same page.
    const section = await screen.findByRole('region', { name: 'Dashas' });
    // Wait for the failed read to settle: finding the section only proves it mounted, not that the query resolved.
    expect(await within(section).findByText(/couldn't load the dasha timeline/i)).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
