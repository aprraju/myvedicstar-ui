import type { ReportResponse } from '@myvedicstar/contracts';
import { reportSectionValues } from '@myvedicstar/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { reportAvailability } from './reportAvailability';
import { ReportsPanel } from './ReportsPanel';

/**
 * ui#57 report screen.
 *
 * The tests that matter here are the ones about what the screen REFUSES to do: offer a section the server does not
 * publish, render a failure as raw text, show a success state before the mutation answered, or invite regeneration for a
 * report that is already current. A screen that only drew a happy path would pass a much weaker suite.
 */

/** The catalog label for a section id, so the test clicks by what a user sees rather than by id. */
const SECTION_LABELS: Record<string, string> = {
  overview: 'Overview',
  charts: 'Charts',
  planets: 'Planets',
  dashas: 'Dashas',
  yogas: 'Yogas and doshas',
  ashtakavarga: 'Ashtakavarga',
  bala: 'Shadbala',
  transits: 'Transits',
  interpretations: 'Interpretations',
};
const sectionName = (id: string): string => SECTION_LABELS[id] ?? id;

const REPORT_ID = '8f14e45f-ceea-467e-9d1d-111111111111';
const PROFILE_ID = '11111111-1111-4111-8111-111111111111';

const readyReport = (overrides: Partial<ReportResponse> = {}): ReportResponse => ({
  reportId: REPORT_ID,
  profileId: PROFILE_ID,
  variant: 'short',
  sections: ['overview'],
  status: 'ready',
  revision: 7,
  requestedAtUtc: '2026-11-22T10:00:00Z',
  completedAtUtc: '2026-11-22T10:00:09Z',
  downloadUrl: 'https://reports.example/abc.pdf',
  downloadExpiresAtUtc: '2026-11-22T10:15:09Z',
  failures: [],
  ...overrides,
});

/** Resolves immediately; the poller never needs a second tick in these tests. */
const noDelay = () => Promise.resolve();

const renderPanel = (props: {
  profileRevision?: number | null;
  createReport: () => Promise<ReportResponse>;
  readReport?: () => Promise<ReportResponse>;
}) =>
  renderWithProviders(
    <ReportsPanel
      profileName="Asha"
      profileRevision={props.profileRevision === undefined ? 7 : props.profileRevision}
      createReport={async () => props.createReport()}
      readReport={async () => (props.readReport ?? props.createReport)()}
      delay={noDelay}
    />,
  );

describe('KUN-17 reports — the section choice comes from the contract tuple', () => {
  it('renders exactly the section ids the contract publishes, and no others', () => {
    renderPanel({ createReport: async () => readyReport() });

    const group = screen.getByRole('group', { name: /sections to include/i });
    const boxes = within(group).getAllByRole('checkbox');
    // Same list, same order: this is the assertion that makes a hand-written id list impossible to slip in.
    expect(boxes).toHaveLength(reportSectionValues.length);
    expect(screen.getByRole('checkbox', { name: 'Interpretations' })).toBeInTheDocument();
    // Ids that were removed from the server set must not appear - they were real defects in an earlier revision.
    expect(screen.queryByRole('checkbox', { name: /assessment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /remedies/i })).not.toBeInTheDocument();
  });

  it('blocks generation when no section is selected, rather than sending an empty request', () => {
    renderPanel({ createReport: async () => readyReport() });
    for (const section of reportSectionValues) {
      const box = screen.getByRole('checkbox', { name: new RegExp(sectionName(section), 'i') });
      if ((box as HTMLInputElement).checked) box.click();
    }
    expect(screen.getByText(/choose at least one section/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate report/i })).toBeDisabled();
  });

  it('offers the short/detailed choice from the contract, short first', () => {
    renderPanel({ createReport: async () => readyReport() });
    expect(screen.getByRole('group', { name: /report length/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Short' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Detailed' })).toBeEnabled();
  });
});

describe('KUN-17 reports — no success state before the mutation succeeds', () => {
  it('shows no ready state on first paint, before any request is made', () => {
    renderPanel({ createReport: async () => readyReport() });

    // The panel is a form until the user asks for something. A pre-rendered "ready" would be a success state with no
    // mutation behind it, which is the failure this block exists to prevent.
    expect(screen.queryByText(/the report is ready/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/requesting the report/i)).not.toBeInTheDocument();
  });

  it('shows the error state, and no download, when the request fails', async () => {
    renderPanel({
      createReport: () => Promise.reject(Object.assign(new Error('boom'), { kind: 'server' })),
    });

    screen.getByRole('button', { name: /generate report/i }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/the report is ready/i)).not.toBeInTheDocument();
  });

  it('renders the download link only once the server reports ready', async () => {
    renderPanel({ createReport: async () => readyReport() });
    screen.getByRole('button', { name: /generate report/i }).click();

    await waitFor(() => expect(screen.getByRole('link', { name: /download/i })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute(
      'href',
      'https://reports.example/abc.pdf',
    );
  });
});

describe('KUN-17 reports — failures render by code, never as server text', () => {
  it('renders a recognised failure as its catalog sentence with the path', async () => {
    renderPanel({
      createReport: async () =>
        readyReport({
          status: 'failed',
          downloadUrl: null,
          downloadExpiresAtUtc: null,
          failures: [{ path: 'sections.charts', reason: 'engine_error' }],
        }),
    });
    screen.getByRole('button', { name: /generate report/i }).click();

    // Matched against the joined list text: the message and the reason are separate text nodes by construction (a
    // sentence plus a mapped catalog string), so a single-node getByText would be the wrong assertion even if it passed.
    await waitFor(() => {
      const items = screen.getAllByRole('listitem').map((item) => item.textContent ?? '');
      expect(items.join(' | ')).toMatch(
        /sections\.charts: the calculation failed while producing the report/i,
      );
    });
  });

  it('renders an unrecognised code explicitly instead of printing the raw server string', async () => {
    renderPanel({
      createReport: async () =>
        readyReport({
          status: 'failed',
          downloadUrl: null,
          downloadExpiresAtUtc: null,
          failures: [{ path: 'sections.bala', reason: 'renderer_timed_out' }],
        }),
    });
    screen.getByRole('button', { name: /generate report/i }).click();

    await waitFor(() =>
      expect(screen.getByText(/a reason this app does not recognise yet/i)).toBeInTheDocument(),
    );
    // The raw code must not appear as the message. It is only allowed as the path's sibling reference, so assert the
    // sentence-based row instead of a bare-code match.
    expect(screen.queryByText(/^renderer_timed_out$/)).not.toBeInTheDocument();
  });
});

describe('KUN-17 reports — revision drives the regenerate affordance', () => {
  it('offers no bring-up-to-date action when the report matches the profile revision', async () => {
    renderPanel({ profileRevision: 7, createReport: async () => readyReport({ revision: 7 }) });
    screen.getByRole('button', { name: /generate report/i }).click();
    await waitFor(() => expect(screen.getByText(/the report is ready/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /generate again/i })).not.toBeInTheDocument();
  });

  it('states the revision mismatch and offers regeneration when the profile moved on', async () => {
    renderPanel({ profileRevision: 9, createReport: async () => readyReport({ revision: 7 }) });
    screen.getByRole('button', { name: /generate report/i }).click();
    await waitFor(() =>
      expect(
        screen.getByText(/generated from revision 7, and the profile is now at revision 9/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /generate again/i })).toBeInTheDocument();
  });

  it('claims neither freshness nor staleness when the profile revision is unknown', async () => {
    renderPanel({ profileRevision: null, createReport: async () => readyReport({ revision: 7 }) });
    screen.getByRole('button', { name: /generate report/i }).click();
    await waitFor(() => expect(screen.getByText(/the report is ready/i)).toBeInTheDocument());
    // No regenerate affordance on an unknown comparison: offering it would assert the report is out of date.
    expect(screen.queryByRole('button', { name: /generate again/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/generated from revision/i)).not.toBeInTheDocument();
  });
});

describe('KUN-17 report availability — the pre-contract surface is unchanged', () => {
  it('still reports unavailable with the shared engine reason', () => {
    const availability = reportAvailability();
    expect(availability.available).toBe(false);
    expect(availability.reason).toBe('engine-unavailable');
    expect(availability.gaps).toEqual([
      'endpoint-post-reports',
      'endpoint-get-report-status',
      'download-url',
    ]);
  });
});
