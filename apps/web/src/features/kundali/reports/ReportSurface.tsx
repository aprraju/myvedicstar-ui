import { reportFailureReasonKey, type ReportResponse, type ReportSection } from '@myvedicstar/contracts';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './ReportSurface.module.css';

/**
 * KUN-17 printable/downloadable report surface.
 *
 * This renders an ALREADY-PRODUCED report. It does not request one, does not poll and holds no timer — that is the
 * request/progress screen's job (owned separately). Its only input is a `ReportResponse`.
 *
 * Rules this component enforces, and why each is a rule rather than a preference:
 *
 * 1. **It accepts a validated value, never raw JSON.** The prop is typed `ReportResponse`, which is
 *    `z.infer<typeof reportResponseSchema>` — a plain string or an unparsed object does not typecheck. A malformed
 *    payload therefore cannot be rendered at all, which is stronger than rendering it defensively: the check happens
 *    once, at the boundary, instead of in every branch here. `ReportSurface.test.tsx` pins this with `@ts-expect-error`.
 *
 * 2. **A missing `downloadUrl` is a sentence, not a dead button.** A disabled-looking control that does nothing is
 *    worse than no control: the user cannot tell whether they lack permission, whether it failed, or whether it is not
 *    ready. When there is no URL we say so, and derive the WHY from `failures` through the shared reason vocabulary.
 *    With no failures recorded there is nothing honest to attribute, and we say that rather than inventing a cause.
 *
 * 3. **`downloadExpiresAtUtc` drives availability.** An expired link is stated as expired and the link is not
 *    rendered — a link that 404s when clicked is the same dead control in a different costume. A missing expiry is
 *    treated as "not stated", not as "never expires": we do not know the link is valid, so we do not claim it is.
 *
 * 4. **Print is a real target.** Sections avoid page-interior breaks, headings are kept with their content, tables
 *    never clip a column (they wrap), and the print sheet is sized for A4 and Letter. The rules live in
 *    `ReportSurface.module.css` under `@media print`.
 */

/** Why a report has no downloadable file, as far as this payload can tell. */
export type DownloadUnavailableReason =
  | { kind: 'not-ready'; status: ReportResponse['status'] }
  | { kind: 'failed'; failures: ReportResponse['failures'] }
  | { kind: 'expired'; expiresAtUtc: string }
  | { kind: 'not-issued'; failures: ReportResponse['failures'] };

/**
 * Decides what to say about the download, from the payload alone.
 *
 * Exported and pure so the decision is testable without rendering, and so the component has no branch of its own: the
 * rule and its test cannot drift apart. Order matters — an expired link on a `failed` report is still a failed report,
 * because "expired" would imply it once worked.
 */
export function downloadUnavailableReason(
  report: ReportResponse,
  now: Date,
): DownloadUnavailableReason | null {
  if (report.downloadUrl !== null) {
    if (report.downloadExpiresAtUtc === null) {
      // A URL with no stated expiry: we cannot claim it is current, so treat it as not issued rather than offering it.
      return { kind: 'not-issued', failures: report.failures };
    }
    const expires = Date.parse(report.downloadExpiresAtUtc);
    if (Number.isNaN(expires)) return { kind: 'not-issued', failures: report.failures };
    if (expires <= now.getTime()) return { kind: 'expired', expiresAtUtc: report.downloadExpiresAtUtc };
    return null;
  }

  if (report.status === 'failed') return { kind: 'failed', failures: report.failures };
  if (report.status !== 'ready') return { kind: 'not-ready', status: report.status };
  return { kind: 'not-issued', failures: report.failures };
}

/** True when a download link may be rendered. */
export function isDownloadAvailable(report: ReportResponse, now: Date): boolean {
  return downloadUnavailableReason(report, now) === null;
}

function formatInstant(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/**
 * The print surface for one produced report.
 *
 * `now` is injected rather than read from the clock inside a render: expiry is an input, and a component that reads
 * the clock is a component that changes its output without a prop changing.
 */
export function ReportSurface({
  report,
  profileName,
  now,
}: {
  report: ReportResponse;
  profileName: string;
  now: Date;
}) {
  const { t } = useTranslation();
  const unavailable = downloadUnavailableReason(report, now);

  return (
    <article className={styles.surface} data-testid="report-surface" data-status={report.status}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('kundali.reports.surface.title', { name: profileName })}</h1>
        <p className={styles.meta}>
          {t('kundali.reports.surface.meta', {
            variant: t(`kundali.reports.variant.${report.variant}`),
            revision: report.revision,
          })}
        </p>
        {report.completedAtUtc !== null && (
          <p className={styles.meta}>
            {t('kundali.reports.surface.completed', { when: formatInstant(report.completedAtUtc) })}
          </p>
        )}
      </header>

      <section className={styles.download} aria-labelledby="report-download-heading">
        <h2 className={styles.heading} id="report-download-heading">
          {t('kundali.reports.surface.downloadHeading')}
        </h2>
        {unavailable === null ? (
          <a
            className={styles.downloadLink}
            href={report.downloadUrl as string}
            data-testid="report-download-link"
          >
            {t('kundali.reports.surface.downloadLink')}
          </a>
        ) : (
          <p
            className={styles.unavailable}
            data-testid="report-download-unavailable"
            data-reason={unavailable.kind}
          >
            {unavailableSentence(unavailable, t)}
          </p>
        )}
        {unavailable?.kind === 'expired' && (
          <p className={styles.meta} data-testid="report-download-expired-at">
            {t('kundali.reports.surface.expiredAt', { when: formatInstant(unavailable.expiresAtUtc) })}
          </p>
        )}
      </section>

      <section className={styles.sections} aria-labelledby="report-sections-heading">
        <h2 className={styles.heading} id="report-sections-heading">
          {t('kundali.reports.surface.sectionsHeading')}
        </h2>
        <ul className={styles.sectionList} data-testid="report-sections">
          {report.sections.map((section) => (
            <li key={section} className={styles.sectionItem}>
              {t(`kundali.reports.section.${section}`)}
            </li>
          ))}
        </ul>
      </section>

      {report.failures.length > 0 && (
        <section className={styles.failures} aria-labelledby="report-failures-heading">
          <h2 className={styles.heading} id="report-failures-heading">
            {t('kundali.reports.surface.failuresHeading')}
          </h2>
          <ul className={styles.failureList} data-testid="report-failures">
            {report.failures.map((failure) => (
              <li key={`${failure.path}-${failure.reason}`}>
                {t('kundali.reports.surface.failureItem', {
                  section: t(`kundali.reports.section.${failure.path as ReportSection}` as never),
                  reason: t(reportFailureReasonKey(failure.reason)),
                })}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/**
 * The first recorded failure's sentence, or the no-reason sentence when none was recorded.
 *
 * Indexing without a non-null assertion on purpose: `failures[0]` is `ReportFailure | undefined` under
 * `noUncheckedIndexedAccess`, and an assertion would be a claim the compiler cannot check. The guard says the same
 * thing in a form that stays true if the array type changes.
 */
function failuresSentence(
  failures: ReportResponse['failures'],
  t: ReturnType<typeof useTranslation>['t'],
  withReason: 'kundali.reports.surface.failedWithReason' | 'kundali.reports.surface.notIssuedWithReason',
  noReason: 'kundali.reports.surface.failedNoReason' | 'kundali.reports.surface.notIssuedNoReason',
): string {
  const first = failures[0];
  return first === undefined
    ? t(noReason)
    : t(withReason, { reason: t(reportFailureReasonKey(first.reason)) });
}

/** The sentence for an unavailable download. One arm per case; there is no fallback that invents a cause. */
function unavailableSentence(
  reason: DownloadUnavailableReason,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  switch (reason.kind) {
    case 'not-ready':
      return t('kundali.reports.surface.notReady', { status: reason.status });
    case 'expired':
      return t('kundali.reports.surface.expired');
    case 'failed':
      return failuresSentence(
        reason.failures,
        t,
        'kundali.reports.surface.failedWithReason',
        'kundali.reports.surface.failedNoReason',
      );
    case 'not-issued':
      return failuresSentence(
        reason.failures,
        t,
        'kundali.reports.surface.notIssuedWithReason',
        'kundali.reports.surface.notIssuedNoReason',
      );
  }
}
