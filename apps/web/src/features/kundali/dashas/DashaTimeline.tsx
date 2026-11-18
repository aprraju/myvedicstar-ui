import type { KundaliDashaPeriod, KundaliDashaTimeline } from '@myvedicstar/contracts';
import type { MessageKey } from '@myvedicstar/localization';
import { useId, useState } from 'react';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import { useFormatters } from '../../../shared/i18n/useFormatters';
import styles from './Dashas.module.css';
import { reasonKey } from './reasonKey';

/**
 * KUN-09: the dasha timeline.
 *
 * Pure presentation over the payload, like the overview and planets sections: nothing here computes a period, extends
 * one to a round date, or invents a boundary. Three rules shape the component:
 *
 *  - `periodPath` is the answer to "which period contains the selected instant". The component never derives that by
 *    comparing the clock to the mahadasha list — a boundary is decided by the engine, and a UI that recomputed it
 *    could disagree with the server about which period the user is in.
 *  - An `unsupported` entry for a path is rendered as an explained absence, not an empty area. "Not built yet",
 *    "computed but not proven" and "cannot know without a birth time" are three different claims and the reason codes
 *    say which one applies.
 *  - Sub-periods are only what the server sent. A mahadasha with no children is stated as such rather than opened to
 *    an empty list that reads like missing data.
 */

/** Levels the UI has words for; anything else is shown with the server's own label, never mis-mapped to one of these. */
const KNOWN_LEVELS = ['mahadasha', 'antardasha', 'pratyantardasha', 'yogini'] as const;

interface LevelLabel {
  key?: MessageKey;
  text?: string;
}

function levelLabel(level: string): LevelLabel {
  const normalised = level.toLowerCase();
  return (KNOWN_LEVELS as readonly string[]).includes(normalised)
    ? { key: `kundali.dashas.level.${normalised}` as MessageKey }
    : { text: level };
}

/** Renders a level label: a catalog key when the level is one we have words for, otherwise the server's own name. */
function useLevelText(label: LevelLabel): string {
  const { t } = useTranslation();
  return label.key ? t(label.key) : (label.text ?? '');
}

/** The same label as a component, for the path list where a hook cannot be called inside a callback. */
function PathLevelText({ level }: { level: string }) {
  return <>{useLevelText(levelLabel(level))}</>;
}

/** Why a path could not be produced, as one sentence. An absent path with no entry still says so rather than nothing. */
function UnsupportedNote({ reason }: { reason: string | undefined }) {
  const { t } = useTranslation();
  return (
    <p className={styles.unsupported} data-reason={reason ?? 'unreported'}>
      {t(reasonKey(reason ?? 'unknown'))}
    </p>
  );
}

function PeriodRow({
  period,
  timeZone,
  current,
  depth,
  children,
}: Readonly<{
  period: KundaliDashaPeriod;
  timeZone: string;
  current: boolean;
  depth: number;
  children?: React.ReactNode;
}>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const labelText = useLevelText(levelLabel(period.level));
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const expandable = Boolean(children);

  return (
    <li className={styles.period} data-depth={depth} data-current={current || undefined}>
      <div className={styles.periodHead}>
        {expandable ? (
          <button
            type="button"
            className={styles.expandButton}
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((value) => !value)}
          >
            <span className={styles.lord}>{period.lord}</span>
            <span className={styles.level}>{labelText}</span>
            <span className={styles.range}>
              {t('kundali.dashas.periodRange', {
                start: format.dateTime(period.startUtc, timeZone),
                end: format.dateTime(period.endUtc, timeZone),
              })}
            </span>
            <span className="visually-hidden">
              {open ? t('kundali.dashas.collapses') : t('kundali.dashas.expands')}
            </span>
          </button>
        ) : (
          <div className={styles.periodStatic}>
            <span className={styles.lord}>{period.lord}</span>
            <span className={styles.level}>{labelText}</span>
            <span className={styles.range}>
              {t('kundali.dashas.periodRange', {
                start: format.dateTime(period.startUtc, timeZone),
                end: format.dateTime(period.endUtc, timeZone),
              })}
            </span>
          </div>
        )}
        {current && <span className={styles.current}>{t('kundali.dashas.current')}</span>}
      </div>
      {expandable && (
        <div id={detailId} hidden={!open} className={styles.subPeriods}>
          {children}
        </div>
      )}
    </li>
  );
}

/**
 * `pathKey` is the (lord, level, startUtc) triple of each period on the path the server resolved at the selected
 * instant, so "current" is a server fact rather than a client-side comparison against the browser clock.
 */
function isOnPath(period: KundaliDashaPeriod, path: readonly KundaliDashaPeriod[]): boolean {
  return path.some(
    (entry) =>
      entry.level === period.level && entry.lord === period.lord && entry.startUtc === period.startUtc,
  );
}

export function DashaTimeline({
  timeline,
  failedPath,
}: Readonly<{
  timeline: KundaliDashaTimeline;
  /** The `unsupported` reason for the period path, when the server withheld it. */
  failedPath?: string | undefined;
}>) {
  const { t } = useTranslation();
  const format = useFormatters();
  const { displayTimezone: timeZone, periodPath, mahadashas } = timeline;
  const pathHeadingId = useId();

  return (
    <div className={styles.timeline} data-testid="dasha-timeline">
      <p className={styles.meta}>
        {t('kundali.dashas.timezone', { zone: timeZone })}
        {timeline.moonLongitude !== undefined && (
          <>
            {' · '}
            {t('kundali.dashas.moonsLongitude', {
              degrees: timeline.moonLongitude.toFixed(2),
            })}
          </>
        )}
        {timeline.at !== undefined && (
          <>
            {' · '}
            {t('kundali.dashas.nowLabel', { at: format.dateTime(timeline.at, timeZone) })}
          </>
        )}
      </p>

      <section aria-labelledby={pathHeadingId} className={styles.path}>
        <h3 id={pathHeadingId} className={styles.subheading}>
          {t('kundali.dashas.pathHeading')}
        </h3>
        {periodPath.length > 0 ? (
          <ol className={styles.pathList} data-testid="dasha-path">
            {periodPath.map((period) => (
              <li key={`${period.level}-${period.lord}-${period.startUtc}`} className={styles.pathItem}>
                <span className={styles.lord}>{period.lord}</span>{' '}
                <span className={styles.level}>
                  <PathLevelText level={period.level} />
                </span>{' '}
                <span className={styles.range}>
                  {t('kundali.dashas.periodRange', {
                    start: format.dateTime(period.startUtc, timeZone),
                    end: format.dateTime(period.endUtc, timeZone),
                  })}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div>
            <p className={styles.pathEmpty}>{t('kundali.dashas.pathEmpty')}</p>
            {failedPath !== undefined && <UnsupportedNote reason={failedPath} />}
          </div>
        )}
      </section>

      <h3 className={styles.subheading}>{t('kundali.dashas.mahadashasHeading')}</h3>
      {mahadashas.length === 0 ? (
        <p className={styles.empty}>{t('kundali.dashas.emptyTimeline')}</p>
      ) : (
        <>
          <p className={styles.help}>{t('kundali.dashas.expandedHelp')}</p>
          <ol
            className={styles.periods}
            aria-label={t('kundali.dashas.timelineLabel', { system: timeline.system })}
          >
            {mahadashas.map((period) => (
              <PeriodRow
                key={`${period.level}-${period.lord}-${period.startUtc}`}
                period={period}
                timeZone={timeZone}
                depth={0}
                current={isOnPath(period, periodPath)}
              >
                <p className={styles.noChildren}>{t('kundali.dashas.noSubPeriods')}</p>
              </PeriodRow>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
