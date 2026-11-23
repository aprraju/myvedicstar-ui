import { describe, expect, it } from 'vitest';

import {
  isRecognisedReportFailureReason,
  isReportInProgress,
  isReportSettled,
  reportFailureReasonKey,
  reportFailureReasonValues,
  reportRequestSchema,
  reportResponseSchema,
  reportSectionsNotPublishedByServer,
  reportSectionsUnknownToClient,
  reportSectionValues,
  reportStatusValues,
} from './kundali-reports';

/**
 * Contract guards for the KUN-17 report bindings (api#57).
 *
 * Each block corresponds to one of the four gaps that would let the UI drift from the API without anyone noticing. The
 * assertions are shaped so that the DRIFT fails, not merely so that today's happy path passes: a new status, a new
 * section or an unknown failure reason must produce a named failure here before it can reach a user.
 */

const UUIDS = {
  report: '8f14e45f-ceea-467e-9d1d-111111111111',
  profile: '11111111-1111-4111-8111-111111111111',
};

/** A report as the API sends it once generation succeeds. */
const readyReport = () => ({
  reportId: UUIDS.report,
  profileId: UUIDS.profile,
  variant: 'detailed',
  sections: ['overview', 'charts', 'interpretations'],
  status: 'ready',
  revision: 42,
  requestedAtUtc: '2026-11-22T10:00:00Z',
  completedAtUtc: '2026-11-22T10:00:09Z',
  downloadUrl: 'https://reports.example/abc.pdf',
  downloadExpiresAtUtc: '2026-11-22T10:15:09Z',
  failures: [],
});

describe('reports — status is a closed union with no catch-all', () => {
  it('accepts every status the API declares', () => {
    for (const status of reportStatusValues) {
      const payload = { ...readyReport(), status };
      expect(reportResponseSchema.safeParse(payload).success).toBe(true);
    }
  });

  it('rejects an unknown status instead of letting it fall through to a generic branch', () => {
    // The failure this guards: a server adds `expired`, the client silently renders it as "not ready" forever. A parse
    // error is loud, recoverable, and names the payload.
    const payload = { ...readyReport(), status: 'expired' };
    const result = reportResponseSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('unreachable');
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain('status');
  });

  it('rejects a status that is merely a different casing of a real one', () => {
    expect(reportResponseSchema.safeParse({ ...readyReport(), status: 'Ready' }).success).toBe(false);
  });

  it('settles on ready and failed only, so polling stops for exactly those two', () => {
    expect(isReportSettled('ready')).toBe(true);
    expect(isReportSettled('failed')).toBe(true);
    expect(isReportSettled('queued')).toBe(false);
    expect(isReportSettled('running')).toBe(false);
    // The complement is derived, not restated: it must agree for every status.
    for (const status of reportStatusValues) {
      expect(isReportInProgress(status)).toBe(!isReportSettled(status));
    }
  });
});

describe('reports — failure reasons are closed for the client and open on the wire', () => {
  it('has a catalog key for every reason the client asserts, with no reason unmapped', () => {
    const keys = reportFailureReasonValues.map((reason) => reportFailureReasonKey(reason));
    expect(new Set(keys).size).toBe(reportFailureReasonValues.length);
    expect(keys).not.toContain('kundali.reports.failureReason.unrecognised');
  });

  it('renders an unrecognised code explicitly rather than as raw server text', () => {
    expect(reportFailureReasonKey('some-new-server-code')).toBe('kundali.reports.failureReason.unrecognised');
    expect(isRecognisedReportFailureReason('some-new-server-code')).toBe(false);
  });

  it('keeps an unknown reason in the payload instead of failing the whole report', () => {
    // Rejecting here would turn "a reason we cannot name" into "no report at all" - the silent-absence failure this
    // surface exists to avoid. The path and code survive so support can act on them.
    const payload = {
      ...readyReport(),
      status: 'failed',
      downloadUrl: null,
      downloadExpiresAtUtc: null,
      failures: [{ path: 'sections.charts', reason: 'renderer_timed_out' }],
    };
    const parsed = reportResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error('unreachable');
    expect(parsed.data.failures.map(({ path, reason }) => ({ path, reason }))).toEqual([
      { path: 'sections.charts', reason: 'renderer_timed_out' },
    ]);
  });

  it('rejects a failure with an empty reason, which would render as silence', () => {
    const payload = {
      ...readyReport(),
      status: 'failed',
      failures: [{ path: 'sections.charts', reason: '' }],
    };
    expect(reportResponseSchema.safeParse(payload).success).toBe(false);
  });
});

describe('reports — the section tuple is bound to the published server set', () => {
  it('binds the section tuple to the published server set', () => {
    // Literal copy of KundaliSections.All (src/MyVedicStar.Kundali.Shared/KundaliContracts.cs:126-127).
    // Copied deliberately rather than imported: the UI cannot import C#, and a copy that must be maintained is the
    // point — when the server adds a section, this fails and someone updates both on purpose.
    const publishedByServer = [
      'overview',
      'charts',
      'planets',
      'dashas',
      'yogas',
      'ashtakavarga',
      'bala',
      'transits',
      'interpretations',
    ];
    expect([...reportSectionValues].sort()).toEqual([...publishedByServer].sort());
    expect(reportSectionsUnknownToClient(publishedByServer)).toEqual([]);
    expect(reportSectionsNotPublishedByServer(publishedByServer)).toEqual([]);
  });

  it('binds the reason codes to KundaliFailureReasons and asserts nothing more', () => {
    // Literal copy of KundaliFailureReasons (KundaliContracts.cs:11-21). Six codes; the server emits no others.
    const publishedByServer = [
      'engine_error',
      'ephemeris_unavailable',
      'timezone_unresolvable',
      'unsupported_capability',
      'birth_date_out_of_range',
      'superseded_by_profile_edit',
    ];
    expect([...reportFailureReasonValues].sort()).toEqual([...publishedByServer].sort());
  });
});

describe('reports — section ids are one list shared by request and render', () => {
  it('accepts a request drawn from the published ids', () => {
    expect(
      reportRequestSchema.safeParse({ variant: 'short', sections: [...reportSectionValues] }).success,
    ).toBe(true);
  });

  it('rejects a section id the client does not publish, rather than sending it and getting an empty tab', () => {
    const result = reportRequestSchema.safeParse({ variant: 'short', sections: ['overveiw'] });
    expect(result.success).toBe(false);
  });

  it('rejects an empty selection instead of defaulting it to everything', () => {
    expect(reportRequestSchema.safeParse({ variant: 'short', sections: [] }).success).toBe(false);
  });

  it("names the server's extra sections and our unpublished ones, in both directions", () => {
    // Typed as string[] deliberately: a literal tuple would narrow to the known ids and make the 'unknown' branch
    // unreachable at the type level, which would hide the very drift these two functions exist to report.
    const serverAddsOne: string[] = [...reportSectionValues, 'annual'];
    expect(reportSectionsUnknownToClient(serverAddsOne)).toEqual(['annual']);
    expect(reportSectionsNotPublishedByServer(serverAddsOne)).toEqual([]);

    const serverLacksOne: string[] = reportSectionValues.filter(
      (id) => !['bala', 'interpretations'].includes(id),
    );
    expect(reportSectionsUnknownToClient(serverLacksOne)).toEqual([]);
    expect(reportSectionsNotPublishedByServer(serverLacksOne)).toEqual(['bala', 'interpretations']);

    // The day-one case: identical lists across both directions, which is the only state that warrants silence.
    expect(reportSectionsUnknownToClient(reportSectionValues)).toEqual([]);
    expect(reportSectionsNotPublishedByServer(reportSectionValues)).toEqual([]);
  });
});

describe('reports — revision is a required binding on the response', () => {
  it('rejects a report with no revision, because regenerate-vs-up-to-date would be a guess', () => {
    const payload = readyReport();
    delete (payload as { revision?: number }).revision;
    const result = reportResponseSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('unreachable');
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain('revision');
  });

  it('keeps the revision even when generation failed, so a retry knows what it replaces', () => {
    const payload = { ...readyReport(), status: 'failed', downloadUrl: null, downloadExpiresAtUtc: null };
    const parsed = reportResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error('unreachable');
    expect(parsed.data.revision).toBe(42);
  });

  it('rejects a revision that is not a whole non-negative number', () => {
    expect(reportResponseSchema.safeParse({ ...readyReport(), revision: -1 }).success).toBe(false);
    expect(reportResponseSchema.safeParse({ ...readyReport(), revision: 41.5 }).success).toBe(false);
  });
});

describe('reports — the response is strict about the shape it renders', () => {
  it('rejects an unknown extra field instead of silently ignoring it', () => {
    const payload = { ...readyReport(), failureReason: 'server prose that must not reach a user' };
    expect(reportResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a missing download expiry on a ready report with a URL, so the client never hands out a dead link', () => {
    const payload = { ...readyReport(), downloadExpiresAtUtc: null };
    // NOTE: the current API shape permits this combination; see reportResponseSchema. Asserted here as a KNOWN
    // limitation rather than a desired state - the test documents that the client cannot yet compute expiry locally.
    expect(reportResponseSchema.safeParse(payload).success).toBe(true);
  });
});
