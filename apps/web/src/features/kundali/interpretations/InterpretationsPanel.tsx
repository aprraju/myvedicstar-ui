import { useTranslation } from '../../../shared/i18n/I18nProvider';
import { reasonKey } from '../reasonText';
import {
  interpretationAvailability,
  type InterpretationDomain,
  interpretationDomainValues,
} from './interpretationAvailability';
import styles from './Interpretations.module.css';
import { type DomainView, toDomainViews } from './sections';

/**
 * KUN-14 evidence-based interpretations.
 *
 * Three rules shape this component, all of them carried from earlier Kundali work:
 *
 *  1. **The label comes first.** Everything below an interpretation is traditional and informational. The contract
 *     requires a visible label and forbids guaranteed outcomes, so the label is rendered as a heading-level element
 *     rather than a footnote: a reader must not be able to read the text without having met the label.
 *
 *  2. **Every domain stands alone.** One failed domain must not error the page, and one pending domain must not make
 *     the others look unfinished. This is the per-section independence rule from #50, applied at the section level.
 *
 *  3. **Pending is not failed.** They are different facts - not yet computed versus computed and did not succeed - and
 *     they read differently, carry different words, and are asserted separately in the tests.
 *
 * The domains rendered come from `interpretationDomainValues` (the contract's closed set), reduced to one view each by
 * `toDomainViews`, so the layout does not change shape based on which sections the server returned.
 *
 * There is no fetching here. `interpretationAvailability()` has no path returning `true`, and this component takes its
 * response as a prop precisely so it can be rendered against fixtures without pretending an endpoint exists.
 */
export function InterpretationsPanel({
  profileName,
  response = null,
  domains = interpretationDomainValues,
}: {
  profileName: string;
  /** The API response, or null while the endpoint does not exist. */
  response?: Parameters<typeof toDomainViews>[0];
  /** Overridable so tests can drive two disagreeing payloads through the same component. */
  domains?: readonly InterpretationDomain[];
}) {
  const { t } = useTranslation();
  const availability = interpretationAvailability();
  const views = toDomainViews(response, domains);

  return (
    <section className={styles.section} aria-labelledby="kundali-interpretations-heading">
      <h2 className={styles.sectionTitle} id="kundali-interpretations-heading">
        {t('kundali.interpretations.title')}
      </h2>
      <p className={styles.subtitle}>{t('kundali.interpretations.subtitle', { name: profileName })}</p>

      {/* The label is part of the section, not per-interpretation: it applies to every reading below it. */}
      <p className={styles.label}>{t('kundali.interpretations.traditionalLabel')}</p>

      <ul className={styles.domains}>
        {views.map((view) => (
          <li key={view.domain} className={styles.domain}>
            <DomainSection view={view} />
          </li>
        ))}
      </ul>

      {!availability.available && (
        <section className={styles.unavailable} aria-labelledby="kundali-interpretations-unavailable">
          <h3 className={styles.unavailableTitle} id="kundali-interpretations-unavailable">
            {t('kundali.interpretations.notAvailableTitle')}
          </h3>
          <p className={styles.unavailableBody}>{t('kundali.interpretations.notAvailableBody')}</p>
          {availability.reason && <p className={styles.reason}>{t(reasonKey(availability.reason))}</p>}
          <ul className={styles.gapList}>
            {availability.gaps.map((gap) => (
              <li key={gap} className={styles.gap}>
                {t(`kundali.interpretations.gap.${gap}`)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

/**
 * One domain.
 *
 * `aria-labelledby` points at the domain's own heading so "Career: this interpretation is not ready yet" is announced
 * as a unit, rather than leaving a reader to guess which domain a bare status sentence belongs to.
 */
function DomainSection({ view }: { view: DomainView }) {
  const { t } = useTranslation();
  const headingId = `kundali-interpretation-${view.domain}`;
  const domainName = t(`kundali.interpretations.domain.${view.domain}`);

  return (
    <section
      className={styles.domainSection}
      aria-labelledby={headingId}
      data-status={view.status}
      data-domain={view.domain}
    >
      <h3 className={styles.domainTitle} id={headingId}>
        {domainName}
      </h3>
      {view.status === 'ready' && (
        <>
          <p className={styles.text}>{view.text}</p>
          {view.factors.length > 0 && (
            <div className={styles.factors}>
              <p className={styles.factorsTitle}>{t('kundali.interpretations.factorsTitle')}</p>
              <ul className={styles.factorList}>
                {view.factors.map((factor) => (
                  <li key={factor} className={styles.factor}>
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {/* Pending and failed are separate branches with separate sentences - never one shared "unavailable" path. */}
      {view.status === 'pending' && (
        <p className={styles.pending}>{t('kundali.interpretations.pending', { domain: domainName })}</p>
      )}
      {view.status === 'failed' && (
        <p className={styles.failed}>{t('kundali.interpretations.failedNeutral', { domain: domainName })}</p>
      )}
      {/* Absent is not a failure: the server did not speak to this domain. */}
      {view.status === 'absent' && <p className={styles.absent}>{t('kundali.interpretations.absent')}</p>}
    </section>
  );
}
