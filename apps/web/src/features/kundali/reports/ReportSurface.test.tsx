import { type ReportResponse, reportResponseSchema } from '@myvedicstar/contracts';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { axeViolations } from '../../../test/axe';
import { renderWithProviders } from '../../../test/render';
import { downloadUnavailableReason, isDownloadAvailable, ReportSurface } from './ReportSurface';

/** A report as the API sends it, parsed through the real schema so the fixture cannot drift from the contract. */
const basePayload = {
  reportId: '11111111-1111-4111-8111-111111111111',
  profileId: '22222222-2222-4222-8222-222222222222',
  variant: 'detailed' as const,
  sections: ['overview', 'planets', 'dashas'] as const,
  status: 'ready' as const,
  revision: 7,
  requestedAtUtc: '2026-11-20T10:00:00+00:00',
  completedAtUtc: '2026-11-20T10:00:42+00:00',
  downloadUrl: 'https://example.test/reports/abc.pdf',
  downloadExpiresAtUtc: '2026-11-27T10:00:00+00:00',
  failures: [] as { path: string; reason: string }[],
};

const NOW = new Date('2026-11-22T12:00:00+00:00');

const report = (overrides: Record<string, unknown> = {}): ReportResponse =>
  reportResponseSchema.parse({ ...basePayload, ...overrides });

describe('KUN-17 report surface — renders only a validated ReportResponse', () => {
  it('renders a produced report from a schema-parsed fixture', () => {
    renderWithProviders(<ReportSurface report={report()} profileName="Asha" now={NOW} />);

    expect(screen.getByTestId('report-surface')).toHaveAttribute('data-status', 'ready');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Kundali report — Asha');
    expect(screen.getByText(/profile revision 7/)).toBeInTheDocument();
    const sections = screen.getByTestId('report-sections');
    expect(within(sections).getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders the download link when the URL is live', () => {
    renderWithProviders(<ReportSurface report={report()} profileName="Asha" now={NOW} />);

    const link = screen.getByTestId('report-download-link');
    expect(link).toHaveAttribute('href', 'https://example.test/reports/abc.pdf');
    expect(screen.queryByTestId('report-download-unavailable')).not.toBeInTheDocument();
  });

  // The @ts-expect-error directive inside each test is the evidence: if the component ever widened its prop to accept an
  // unparsed object, the directive would become unused and `tsc` would fail the build. The test then also asserts the
  // runtime consequence, which is a throw from the component's own field access.
  it('rejects an unvalidated object at the type level (@ts-expect-error evidence)', () => {
    expect(() => {
      const unvalidated = { reportId: 'not-a-uuid', status: 'ready' };
      // @ts-expect-error a raw JSON object is not a ReportResponse; only the parsed schema output is
      renderWithProviders(<ReportSurface report={unvalidated} profileName="Asha" now={NOW} />);
    }).toThrow();
  });

  it('rejects a bare string at the type level (@ts-expect-error evidence)', () => {
    expect(() => {
      const rawJson = JSON.stringify({ status: 'ready' });
      // @ts-expect-error a string is not a parsed report
      renderWithProviders(<ReportSurface report={rawJson} profileName="Asha" now={NOW} />);
    }).toThrow();
  });
});

describe('KUN-17 report surface — an unavailable download is a sentence, not a dead button', () => {
  it('states why there is no download when downloadUrl is null and a failure was recorded', () => {
    renderWithProviders(
      <ReportSurface
        report={report({
          status: 'failed',
          downloadUrl: null,
          downloadExpiresAtUtc: null,
          failures: [{ path: 'planets', reason: 'ephemeris_unavailable' }],
        })}
        profileName="Asha"
        now={NOW}
      />,
    );

    const unavailable = screen.getByTestId('report-download-unavailable');
    expect(unavailable).toHaveAttribute('data-reason', 'failed');
    expect(unavailable).toHaveTextContent(/planetary data needed for this report was unavailable/);
    // The failure shape this forbids: a control that looks clickable but is not.
    expect(screen.queryByTestId('report-download-link')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says so plainly when downloadUrl is null and no reason was recorded', () => {
    renderWithProviders(
      <ReportSurface
        report={report({ status: 'ready', downloadUrl: null, downloadExpiresAtUtc: null })}
        profileName="Asha"
        now={NOW}
      />,
    );

    expect(screen.getByTestId('report-download-unavailable')).toHaveAttribute('data-reason', 'not-issued');
    expect(screen.getByTestId('report-download-unavailable')).toHaveTextContent(/no reason was recorded/);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders an unrecognised failure reason explicitly rather than as raw server text', () => {
    renderWithProviders(
      <ReportSurface
        report={report({
          status: 'failed',
          downloadUrl: null,
          downloadExpiresAtUtc: null,
          failures: [{ path: 'planets', reason: 'a_reason_from_the_future' }],
        })}
        profileName="Asha"
        now={NOW}
      />,
    );

    const unavailable = screen.getByTestId('report-download-unavailable');
    expect(unavailable).not.toHaveTextContent('a_reason_from_the_future');
    expect(unavailable).toHaveTextContent(/does not recognise yet/);
  });
});

describe('KUN-17 report surface — downloadExpiresAtUtc drives the display', () => {
  it('states an expired link as expired and does not render it', () => {
    renderWithProviders(
      <ReportSurface
        report={report({ downloadExpiresAtUtc: '2026-11-21T10:00:00+00:00' })}
        profileName="Asha"
        now={NOW}
      />,
    );

    const unavailable = screen.getByTestId('report-download-unavailable');
    expect(unavailable).toHaveAttribute('data-reason', 'expired');
    expect(unavailable).toHaveTextContent(/expired/);
    expect(screen.queryByTestId('report-download-link')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByTestId('report-download-expired-at')).toBeInTheDocument();
  });

  it('treats a URL with no stated expiry as not issued, because validity cannot be claimed', () => {
    renderWithProviders(
      <ReportSurface report={report({ downloadExpiresAtUtc: null })} profileName="Asha" now={NOW} />,
    );

    expect(screen.queryByTestId('report-download-link')).not.toBeInTheDocument();
    expect(screen.getByTestId('report-download-unavailable')).toHaveAttribute('data-reason', 'not-issued');
  });

  it('offers the link up to the expiry instant and withholds it at the instant', () => {
    const expiresAtUtc = '2026-11-22T12:00:00+00:00';
    const justBefore = new Date('2026-11-22T11:59:59+00:00');
    expect(isDownloadAvailable(report({ downloadExpiresAtUtc: expiresAtUtc }), justBefore)).toBe(true);
    expect(isDownloadAvailable(report({ downloadExpiresAtUtc: expiresAtUtc }), NOW)).toBe(false);
    expect(downloadUnavailableReason(report({ downloadExpiresAtUtc: expiresAtUtc }), NOW)).toEqual({
      kind: 'expired',
      expiresAtUtc,
    });
  });

  it('treats an expired link as expired: expiry outranks the report status', () => {
    const outcome = downloadUnavailableReason(
      report({
        status: 'failed',
        downloadExpiresAtUtc: '2026-11-21T10:00:00+00:00',
        failures: [{ path: 'overview', reason: 'engine_error' }],
      }),
      NOW,
    );
    // "expired" would imply it once worked, which would be a false history.
    expect(outcome).toEqual({ kind: 'expired', expiresAtUtc: '2026-11-21T10:00:00+00:00' });
  });
});

describe('KUN-17 report surface — accessibility', () => {
  it('has no axe violations with a link present', async () => {
    const { container } = renderWithProviders(
      <ReportSurface report={report()} profileName="Asha" now={NOW} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no axe violations with an unavailable download', async () => {
    const { container } = renderWithProviders(
      <ReportSurface
        report={report({ downloadUrl: null, downloadExpiresAtUtc: null })}
        profileName="Asha"
        now={NOW}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
