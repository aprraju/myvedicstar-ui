import {
  isReportSettled,
  reportFailureReasonKey,
  type ReportResponse,
  type ReportSection,
  reportSectionValues,
  reportVariantValues,
} from '@myvedicstar/contracts';
import { useId, useState } from 'react';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from '../Kundali.module.css';
import { reportFreshness, shouldOfferRegenerate } from './reportFreshness';
import { ReportSurface } from './ReportSurface';
import { type ReportPollOptions, useReportPolling } from './useReportPolling';

/**
 * KUN-17 report screen (ui#57).
 *
 * The consumer of `packages/contracts/src/kundali-reports.ts`. Five rules, each traceable to a contract property:
 *
 *  1. **The section checkboxes are rendered FROM `reportSectionValues`**, never from a hand-written list. That tuple is
 *     asserted against the server's `KundaliSections.All` by the contract test, so the UI cannot offer a section the
 *     renderer will reject, and a server-side addition fails the suite rather than producing a tab that never fills.
 *  2. **Settling is `isReportSettled` only** — the poller owns that decision, and this component reads the state it
 *     reports. A second "is it done?" expression here is exactly the drift the predicate exists to prevent.
 *  3. **Failure text comes from `reportFailureReasonKey`**, so an unrecognised code renders the explicit "unrecognised"
 *     sentence. No server string is ever rendered: only `reason` codes pass through the mapping, and the raw code is
 *     shown alongside as a support reference, in the same spirit as the rest of Kundali.
 *  4. **Regeneration is offered only for a STALE report**, decided by `reportFreshness` against the profile's current
 *     revision. A current report does not get a button that would produce the file the user already has.
 *  5. **Nothing is cached and no success state precedes the mutation.** The panel shows the server's own report object
 *     or an error; there is no optimistic "ready" and no local copy of a PDF.
 */
export function ReportsPanel({
  profileName,
  profileRevision,
  createReport,
  readReport,
  delay,
}: {
  profileName: string;
  /** The profile's current revision, or null while unknown. Drives the stale/current decision, nothing else. */
  profileRevision: number | null;
  /** Passed through to the poller; present so tests can settle a poll without waiting on a timer. */
  delay?: ((ms: number, signal: AbortSignal) => Promise<void>) | undefined;
} & Pick<ReportPollOptions, 'createReport' | 'readReport'>) {
  const { t } = useTranslation();
  const headingId = useId();
  const variantName = useId();

  const [variant, setVariant] = useState<ReportResponse['variant']>('short');
  // Every section selected by default: a "short" report is a per-section length, not a subset. The user deselects what
  // they do not want, which is the only direction that cannot silently omit a section they expected.
  const [sections, setSections] = useState<readonly ReportSection[]>([...reportSectionValues]);

  // Injected rather than read inside the surface, following #158's rule that expiry is an input. It is captured when the
  // report arrives, not on every render: a ticking clock would re-decide "expired" mid-interaction.
  const [reportNow, setReportNow] = useState<Date>(() => new Date());

  const poll = useReportPolling({ createReport, readReport, delay });
  const report = poll.report;
  const freshness = report ? reportFreshness(report, profileRevision) : null;

  const start = (input: { variant: ReportResponse['variant']; sections: readonly ReportSection[] }) => {
    setReportNow(new Date());
    poll.request(input);
  };

  const toggleSection = (section: ReportSection) => {
    setSections((current) =>
      current.includes(section) ? current.filter((id) => id !== section) : [...current, section],
    );
  };

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 className={styles.sectionTitle} id={headingId}>
        {t('kundali.reports.title')}
      </h2>
      <p className={styles.subtitle}>{t('kundali.reports.subtitle', { name: profileName })}</p>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('kundali.reports.variantLegend')}</legend>
        {reportVariantValues.map((value) => (
          <label key={value} className={styles.modeOption}>
            <input
              type="radio"
              name={variantName}
              value={value}
              checked={variant === value}
              onChange={() => setVariant(value)}
            />
            <span>{t(`kundali.reports.variant.${value}`)}</span>
          </label>
        ))}
      </fieldset>
      <p className={styles.hint}>{t('kundali.reports.variantHint')}</p>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('kundali.reports.sections.legend')}</legend>
        {/* Rendered from the contract tuple. A section id that is not in `reportSectionValues` cannot appear here, and
            one removed from the server's published set fails the binding test before it can be offered. */}
        {reportSectionValues.map((section) => (
          <label key={section} className={styles.modeOption}>
            <input
              type="checkbox"
              checked={sections.includes(section)}
              onChange={() => toggleSection(section)}
            />
            <span>{t(`kundali.reports.section.${section}`)}</span>
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        className={styles.button}
        disabled={sections.length === 0 || poll.status === 'requesting' || poll.status === 'polling'}
        onClick={() => start({ variant, sections })}
      >
        {t('kundali.reports.generate')}
      </button>
      {sections.length === 0 && <p className={styles.hint}>{t('kundali.reports.sections.noneSelected')}</p>}

      {/* The payload has not arrived yet. Not an error, and deliberately not worded as one. */}
      {poll.status === 'requesting' && <p className={styles.hint}>{t('kundali.reports.requesting')}</p>}

      {poll.status === 'error' ? (
        <div className={styles.unavailable} role="alert">
          <p className={styles.unavailableBody}>{t('kundali.reports.requestFailed')}</p>
          <button type="button" className={styles.button} onClick={poll.reload}>
            {t('kundali.retry')}
          </button>
        </div>
      ) : null}

      {report && !isReportSettled(report.status) ? (
        <p className={styles.hint} aria-live="polite">
          {t(`kundali.reports.status.${report.status}`)}
        </p>
      ) : null}

      {report && isReportSettled(report.status) ? (
        <section className={styles.unavailable} aria-labelledby={`${headingId}-result`}>
          <h3 className={styles.unavailableTitle} id={`${headingId}-result`}>
            {t(`kundali.reports.status.${report.status}`)}
          </h3>

          {freshness?.kind === 'stale' ? (
            <>
              <p className={styles.unavailableBody}>
                {t('kundali.reports.stale.body', {
                  reportRevision: freshness.reportRevision,
                  profileRevision: freshness.profileRevision,
                })}
              </p>
              {shouldOfferRegenerate(freshness) && (
                <button type="button" className={styles.button} onClick={() => start({ variant, sections })}>
                  {t('kundali.reports.stale.regenerate')}
                </button>
              )}
            </>
          ) : null}

          {/* The produced report — status, sections, download availability AND expiry — is drawn by ReportSurface
              (merged #158), not here. One renderer per fact: this component owns request, progress and the revision
              decision, and hands the settled payload over. Duplicating the download logic here would be the second
              opinion that #158's expiry rule exists to prevent. */}
          <ReportSurface report={report} profileName={profileName} now={reportNow} />

          {report.failures.length > 0 ? (
            <ul className={styles.placementList}>
              {report.failures.map((failure) => (
                <li key={`${failure.path}:${failure.reason}`} className={styles.placement}>
                  {/* The sentence comes from the catalog via reportFailureReasonKey. The raw code is shown as a
                      reference, never as the message itself. */}
                  {t('kundali.reports.failure.item', {
                    path: failure.path,
                    reason: t(reportFailureReasonKey(failure.reason)),
                  })}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
