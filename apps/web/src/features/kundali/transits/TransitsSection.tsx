import type { KundaliTransitsSection } from '@myvedicstar/contracts';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Transits.module.css';

/**
 * KUN-13: dated transits, Sade Sati and alert subscriptions.
 *
 * Rules this section enforces, and where each one lives:
 *
 * 1. **An absent graha is absent, not zero.** `saturn` and `jupiter` are nullable in the contract because the engine
 *    may not have evaluated them for this profile. Absence renders as an explicit "not available for this profile"
 *    line carrying the reason vocabulary the rest of Kundali uses - never as 0°, never as "direct".
 * 2. **A partial Sade Sati is labelled partial.** `isPartial` means the interval was truncated at a search edge, so
 *    the reported start and end are the edge of what was *observed*, not the edge of the phase. The label sits on the
 *    same block as the dates: a caveat somewhere else on the page is a caveat the user never reads.
 * 3. **Windows are start-inclusive, end-exclusive.** Formatting says so in the caption, because a reader comparing
 *    two adjacent windows otherwise sees an overlap that does not exist.
 * 4. **Freshness is stated.** Reference, computed and expiry instants are all rendered in the profile's own timezone;
 *    an undated transit number is a number with no meaning.
 */

function formatInstant(iso: string, timeZoneId: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timeZoneId,
  }).format(new Date(iso));
}

function formatDate(iso: string, timeZoneId: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: timeZoneId }).format(
    new Date(iso),
  );
}

/** One graha block, or an explicit absence. */
function GrahaBlock({
  label,
  graha,
  timeZoneId,
}: {
  label: string;
  graha: KundaliTransitsSection['saturn'];
  timeZoneId: string;
}) {
  const { t } = useTranslation();

  if (graha === null) {
    return (
      <div className={styles.graha} data-testid={`transit-${label.toLowerCase()}`} data-state="absent">
        <h4 className={styles.grahaTitle}>{label}</h4>
        <p className={styles.absent}>{t('kundali.transits.grahaAbsent', { graha: label })}</p>
      </div>
    );
  }

  return (
    <div className={styles.graha} data-testid={`transit-${label.toLowerCase()}`} data-state="present">
      <h4 className={styles.grahaTitle}>{label}</h4>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{t('kundali.transits.sign')}</dt>
          <dd>{graha.sign}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('kundali.transits.longitude')}</dt>
          <dd>
            {graha.longitude === null ? (
              <span className={styles.absentValue}>{t('kundali.transits.valueAbsent')}</span>
            ) : (
              `${graha.longitude.toFixed(2)}°`
            )}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('kundali.transits.motion')}</dt>
          <dd>
            {graha.isRetrograde === null ? (
              <span className={styles.absentValue}>{t('kundali.transits.valueAbsent')}</span>
            ) : graha.isRetrograde ? (
              t('kundali.transits.retrograde')
            ) : (
              t('kundali.transits.direct')
            )}
          </dd>
        </div>
      </dl>

      {graha.windows.length > 0 && (
        <div
          className={styles.tableWrap}
          tabIndex={0}
          role="region"
          aria-label={t('kundali.transits.windowTableLabel', { graha: label })}
        >
          <table className={styles.table}>
            <caption className="visually-hidden">
              {t('kundali.transits.windowCaption', { graha: label })}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('kundali.transits.column.sign')}</th>
                <th scope="col">{t('kundali.transits.column.from')}</th>
                <th scope="col">{t('kundali.transits.column.until')}</th>
              </tr>
            </thead>
            <tbody>
              {graha.windows.map((window) => (
                <tr key={`${window.sign}-${window.startUtc}`}>
                  <td>{window.sign}</td>
                  <td>{formatDate(window.startUtc, timeZoneId)}</td>
                  <td>{formatDate(window.endUtc, timeZoneId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function TransitsSection({
  section,
  timeZoneId,
}: {
  section: KundaliTransitsSection;
  timeZoneId: string;
}) {
  const { t } = useTranslation();
  const sadeSati = section.sadeSati;

  // The nullable alone cannot distinguish "no interval in span" from "the calculation had a gap": both can arrive with
  // sadeSati null. The reason vocabulary in `unsupported` is what separates them, so the branch is driven from it
  // rather than from the null. `SadeSati` on its own is the gap case; `SadeSati.Active` with not-yet-active is the
  // future-window case, which is a real answer about a real interval.
  const sadeSatiGap = section.unsupported.find(
    (entry) => entry.path === 'SadeSati' && entry.reason !== 'no-interval-in-span',
  )?.reason;
  const sadeSatiNotYetActive = section.unsupported.some(
    (entry) => entry.path === 'SadeSati.Active' && entry.reason === 'not-yet-active',
  );

  return (
    <div className={styles.body} data-testid="transits-body">
      <p className={styles.freshness}>
        {t('kundali.transits.freshness', {
          reference: formatInstant(section.referenceInstant, timeZoneId),
          computed: formatInstant(section.computedAt, timeZoneId),
          expires: formatInstant(section.expiresAt, timeZoneId),
        })}
      </p>

      <section className={styles.subsection} aria-labelledby="kundali-transits-grahas">
        <h3 className={styles.subTitle} id="kundali-transits-grahas">
          {t('kundali.transits.grahasTitle')}
        </h3>
        <GrahaBlock label={t('kundali.transits.saturn')} graha={section.saturn} timeZoneId={timeZoneId} />
        <GrahaBlock label={t('kundali.transits.jupiter')} graha={section.jupiter} timeZoneId={timeZoneId} />
      </section>

      <section className={styles.subsection} aria-labelledby="kundali-transits-sadesati">
        <h3 className={styles.subTitle} id="kundali-transits-sadesati">
          {t('kundali.transits.sadeSatiTitle')}
        </h3>
        {/* Order matters: the gap check comes FIRST, because a gap can also arrive with sadeSati null. Testing the null
            before the reason is how "could not be calculated" gets read as the reassuring "no period applies". */}
        {sadeSatiGap ? (
          // A genuine gap in the calculation. Name the reason so the absence is explicable - and so nobody infers a
          // phase that was never computed.
          <p className={styles.absent} data-testid="sadesati" data-state="unavailable">
            {t('kundali.transits.sadeSatiUnavailable', { reason: sadeSatiGap })}
          </p>
        ) : sadeSati === null ? (
          // null WITHOUT a gap reason is a COMPUTED answer. KundaliFacade's else-branch always emits
          // SadeSati/no-interval-in-span: the engine searched the span and found no interval. The two must never share a
          // sentence, because a user clear of Sade Sati would read the reassuring one either way.
          <p className={styles.absent} data-testid="sadesati" data-state="no-interval">
            {t('kundali.transits.sadeSatiNoneInSpan')}
          </p>
        ) : sadeSatiNotYetActive ? (
          // The interval exists and its start is known: the whole window is in the future. Branched on the unsupported
          // entry, which is the ONLY wire signal for this case - the payload also has phases populated and active false,
          // so any condition built from those alone renders a normal block that never says it has not begun.
          <p className={styles.notYetActive} data-testid="sadesati" data-state="not-yet-active">
            {t('kundali.transits.sadeSatiBeginsOn', {
              date: formatDate(sadeSati.startUtc, timeZoneId),
            })}
          </p>
        ) : !sadeSati.active ? (
          // Calculated, and no phase is current at the reference instant. Deliberately NOT conditioned on
          // phases.length: the engine populates every phase of the interval regardless of where the instant falls, so an
          // empty list is not what "no phase now" means and a length check would almost never fire.
          <p className={styles.absent} data-testid="sadesati" data-state="not-active">
            {t('kundali.transits.sadeSatiNotActive')}
          </p>
        ) : (
          <div className={styles.sadeSati} data-testid="sadesati" data-partial={sadeSati.isPartial}>
            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt>{t('kundali.transits.phase')}</dt>
                <dd>{sadeSati.phase}</dd>
              </div>
              <div className={styles.fact}>
                <dt>{t('kundali.transits.moonSign')}</dt>
                <dd>{sadeSati.moonSign}</dd>
              </div>
              <div className={styles.fact}>
                <dt>{t('kundali.transits.status')}</dt>
                <dd>{sadeSati.active ? t('kundali.transits.active') : t('kundali.transits.inactive')}</dd>
              </div>
              <div className={styles.fact}>
                <dt>{t('kundali.transits.observed')}</dt>
                <dd>
                  {t('kundali.transits.range', {
                    from: formatDate(sadeSati.startUtc, timeZoneId),
                    to: formatDate(sadeSati.endUtc, timeZoneId),
                  })}
                </dd>
              </div>
            </dl>

            {/* The truncation caveat belongs on the same block as the dates it qualifies. A partial interval's
                boundaries are the edge of observation, not the edge of the phase. */}
            {sadeSati.isPartial && (
              <p className={styles.partial} data-testid="sadesati-partial">
                {t('kundali.transits.sadeSatiPartial')}
              </p>
            )}

            {sadeSati.phases.length > 0 && (
              <div
                className={styles.tableWrap}
                tabIndex={0}
                role="region"
                aria-label={t('kundali.transits.phaseTableLabel')}
              >
                <table className={styles.table}>
                  <caption className="visually-hidden">{t('kundali.transits.phaseCaption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('kundali.transits.column.phase')}</th>
                      <th scope="col">{t('kundali.transits.column.sign')}</th>
                      <th scope="col">{t('kundali.transits.column.from')}</th>
                      <th scope="col">{t('kundali.transits.column.until')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sadeSati.phases.map((phase) => (
                      <tr key={`${phase.phase}-${phase.startUtc}`}>
                        <td>{phase.phase}</td>
                        <td>{phase.sign}</td>
                        <td>{formatDate(phase.startUtc, timeZoneId)}</td>
                        <td>{formatDate(phase.endUtc, timeZoneId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={styles.subsection} aria-labelledby="kundali-transits-dated">
        <h3 className={styles.subTitle} id="kundali-transits-dated">
          {t('kundali.transits.datedTitle')}
        </h3>
        {section.datedTransits.length === 0 ? (
          <p className={styles.empty} data-testid="dated-transits">
            {t('kundali.transits.noDated')}
          </p>
        ) : (
          <div
            className={styles.tableWrap}
            tabIndex={0}
            role="region"
            aria-label={t('kundali.transits.datedTableLabel')}
          >
            <table className={styles.table} data-testid="dated-transits">
              <caption className="visually-hidden">{t('kundali.transits.datedCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('kundali.transits.column.graha')}</th>
                  <th scope="col">{t('kundali.transits.column.event')}</th>
                  <th scope="col">{t('kundali.transits.column.sign')}</th>
                  <th scope="col">{t('kundali.transits.column.at')}</th>
                </tr>
              </thead>
              <tbody>
                {section.datedTransits.map((event) => (
                  <tr key={`${event.graha}-${event.eventType}-${event.atUtc}`}>
                    <td>{event.graha}</td>
                    <td>{event.eventType}</td>
                    <td>{event.sign}</td>
                    <td>{formatInstant(event.atUtc, timeZoneId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {section.unsupported.length > 0 && (
        <section className={styles.subsection} aria-labelledby="kundali-transits-unsupported">
          <h3 className={styles.subTitle} id="kundali-transits-unsupported">
            {t('kundali.transits.unsupportedTitle')}
          </h3>
          <ul className={styles.unsupported} data-testid="transits-unsupported">
            {section.unsupported.map((entry) => (
              <li key={`${entry.path}-${entry.reason}`}>
                {t('kundali.transits.unsupportedItem', { path: entry.path, reason: entry.reason })}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
