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
    // Settle on the assessment headings: the dasha section renders its own status region while its content arrives, so
    // a generic "nothing says loading" wait can never settle.
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 2, name: /Yoga/i }).length).toBeGreaterThan(0),
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

  it('keeps one live region across the load transition, changing its text rather than replacing the node', async () => {
    // Hold the yogas response open so the loading state is observable rather than racing the promise.
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    storeSelectedLocation();
    server.use(
      http.get(api('/vedic-profiles'), () => HttpResponse.json([profile])),
      http.get(api(`/kundali/${PROFILE_ID}/sections/dashas`), () => HttpResponse.json(dashas)),
      http.get(api(`/kundali/${PROFILE_ID}/sections/ashtakavarga`), () =>
        HttpResponse.json(computedAshtakavarga),
      ),
      http.get(api(`/kundali/${PROFILE_ID}/sections/yogas`), async () => {
        await gate;
        return HttpResponse.json(withheld);
      }),
    );
    renderRoute(`/kundali?profile=${PROFILE_ID}`, { auth: signedIn() });

    // Capture the region BEFORE the sections resolve. This is the property a snapshot cannot prove: two different
    // nodes with role="status" would each be individually valid and still announce nothing, because a screen reader
    // has no reason to connect the second node's text to the first node's disappearance.
    // The yogas section's own region. It is present from first render (the query starts pending), so grab it before the
    // response lands - that ordering is the whole point of the assertion, so it is captured, not awaited into existence.
    const yogasRegion = await waitFor(() => {
      const found = Array.from(document.querySelectorAll('[role="status"]')).find((node) =>
        /Loading Yogas/i.test(node.textContent ?? ''),
      );
      expect(found, 'the yogas section announces loading from its own region').toBeDefined();
      return found as Element;
    });

    // Release the response and let the section resolve.
    release?.();
    await waitFor(() => expect(yogasRegion?.textContent).toMatch(/loaded/i));

    // The same node, still in the document, whose text now says the section loaded.
    // Same element identity: the node captured before resolution is still the one announcing, with new text.
    expect(yogasRegion).toBeInTheDocument();
    expect(yogasRegion?.textContent).toMatch(/loaded/i);
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
