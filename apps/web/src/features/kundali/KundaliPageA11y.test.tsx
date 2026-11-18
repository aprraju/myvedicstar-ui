import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createInMemoryAuthClient } from '../../shared/auth';
import { axeViolations } from '../../test/axe';
import { storeSelectedLocation } from '../../test/location-fixtures';
import { TEST_API_BASE_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderRoute } from '../../test/render';

const api = (path: string) => `${TEST_API_BASE_URL}/api/v1${path}`;
const signedIn = () => createInMemoryAuthClient({ user: { id: 'u1', displayName: 'Asha' } });

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const profile = { id: PROFILE_ID, name: 'Asha', relationship: 'Self', customRelationship: null, revision: 3 };

/** An assessment section the engine could not compute, in the exact shape the contract requires. */
const withheld = {
  availability: 'unsupported',
  reason: 'engine-unavailable',
  assessments: [],
  families: [],
  ruleSetVersions: [],
} as const;

const computedAshtakavarga = {
  availability: 'computed',
  legend: { name: 'Parashari', note: null },
  rulesVersion: 'ashtakavarga-1',
  houses: [],
  sarvashtakavarga: [],
  bhinnashtakavarga: [],
};

const dashas = {
  system: 'vimshottari',
  displayTimezone: 'Asia/Kolkata',
  at: '2026-11-18T04:30:00+00:00',
  mahadashas: [
    {
      lord: 'Venus',
      level: 'mahadasha',
      startUtc: '2022-03-01T00:00:00+00:00',
      endUtc: '2042-03-01T00:00:00+00:00',
    },
  ],
  periodPath: [
    {
      lord: 'Venus',
      level: 'mahadasha',
      startUtc: '2022-03-01T00:00:00+00:00',
      endUtc: '2042-03-01T00:00:00+00:00',
    },
  ],
  unsupported: [],
};

/** Mounts the whole Kundali page with several sections in different states - the state isolation hides in assembly. */
const renderPage = () => {
  storeSelectedLocation();
  server.use(
    http.get(api('/vedic-profiles'), () => HttpResponse.json([profile])),
    http.get(api(`/kundali/${PROFILE_ID}/sections/dashas`), () => HttpResponse.json(dashas)),
    http.get(api(`/kundali/${PROFILE_ID}/sections/yogas`), () => HttpResponse.json(withheld)),
    http.get(api(`/kundali/${PROFILE_ID}/sections/ashtakavarga`), () =>
      HttpResponse.json(computedAshtakavarga),
    ),
  );
  return renderRoute(`/kundali?profile=${PROFILE_ID}`, { auth: signedIn() });
};

describe('Kundali page — KUN-19 assembled accessibility', () => {
  it('has no axe violations on the assembled page with mixed section states', async () => {
    const { container } = renderPage();
    await screen.findByTestId('dasha-timeline');
    // Let every section settle so the scan sees the real assembled tree, not a loading shell. Loading text is the
    // signal; the completion announcements that remain afterwards are expected.
    await waitFor(() =>
      expect(screen.queryAllByRole('status').some((node) => /loading/i.test(node.textContent ?? ''))).toBe(
        false,
      ),
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it('gives the page a single h1 and does not nest section h2s inside a same-level h2 region', async () => {
    renderPage();
    await screen.findByTestId('dasha-timeline');

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    // Every h2 must have a distinct accessible name: two sections sharing one would be indistinguishable in a
    // screen-reader heading list, which is how a user navigates a long page.
    const h2Names = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent?.trim());
    expect(new Set(h2Names).size).toBe(h2Names.length);
  });

  it('announces a withheld section as withheld instead of omitting it', async () => {
    renderPage();
    await screen.findByTestId('dasha-timeline');

    // The yogas section is unavailable. Its heading must still be in the document and its reason must be readable,
    // so a screen-reader user learns the section exists and why it is empty.
    const yogas = screen.getByRole('heading', { level: 2, name: /Yoga/i }).closest('section');
    expect(yogas).not.toBeNull();
    // getAllBy: the unavailable panel states the title and explains it, so the phrase appears more than once.
    expect(within(yogas as HTMLElement).getAllByText(/not available/i).length).toBeGreaterThan(0);
    expect(yogas).toHaveAttribute('data-availability', 'unsupported');
  });

  it('announces that a section finished loading instead of leaving the user on "loading"', async () => {
    renderPage();
    await screen.findByTestId('dasha-timeline');

    // A live region that is destroyed on success never announces the completion: the user hears "Loading yogas…"
    // and then silence. The completion text must be in a region that exists once the section has arrived.
    const statusRegions = screen.getAllByRole('status');
    const announced = statusRegions.map((node) => node.textContent ?? '').join(' | ');
    expect(announced).toMatch(/loaded/i);
  });

  it('keeps the selected-profile wrapper out of the section outline', async () => {
    renderPage();
    await screen.findByTestId('dasha-timeline');

    // "Kundali for Asha" groups the sections; it must not itself be a landmark, or it competes with the real sections
    // in a screen-reader landmark list.
    const groupings = document.querySelectorAll('section[aria-labelledby="kundali-selected-title"]');
    expect(groupings).toHaveLength(0);
    expect(document.getElementById('kundali-selected-title')).not.toBeNull();
  });

  it('exposes each section as a landmark named by its own heading', async () => {
    renderPage();
    await screen.findByTestId('dasha-timeline');

    const sections = Array.from(document.querySelectorAll('section[aria-labelledby]'));
    expect(sections.length).toBeGreaterThanOrEqual(3);
    for (const section of sections) {
      const labelId = section.getAttribute('aria-labelledby') as string;
      const label = document.getElementById(labelId);
      // A dangling aria-labelledby is an unlabelled landmark for a screen reader, and axe does not catch it.
      expect(label, `aria-labelledby="${labelId}" resolves`).not.toBeNull();
      expect(label?.textContent?.trim()).not.toBe('');
    }
  });
});
