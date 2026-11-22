import {
  type KundaliRemediesSection,
  parseRemedyFindingStatus,
  remediesSuppressedByStatus,
  remediesThatMayRender,
} from '@myvedicstar/contracts';
import { useId, useState } from 'react';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Remedies.module.css';

/**
 * KUN-16: optional traditional remedies, each bound to the finding it addresses.
 *
 * Rules this section enforces, and where each one lives:
 *
 * 1. **A remedy renders only beside an `evaluated` finding.** The filter is `remediesThatMayRender` from the contract
 *    package, not an inline condition, so a renderer cannot quietly widen it. `findingStatus` is parsed, never cast:
 *    an unreadable status resolves to `unknown-code` and therefore cannot render.
 * 2. **A suppressed item is reported, not dropped.** Entries the server sent with a non-rendering status are counted and
 *    named beneath the list, and `unsupported` is rendered with its reason. A section that only shows its items cannot
 *    distinguish "nothing applies" from "the engine could not assess this", which is the defect the API was built to
 *    prevent.
 * 3. **The catalogue version is stated.** A remedy list rendered against a catalogue that has since changed is a stale
 *    answer; the version is the only thing that makes that visible.
 * 4. **No purchase, no guaranteed outcome, no health prescription.** The section says so once, in its own words, rather
 *    than trusting every suggestion string to repeat it.
 * 5. **Optional means collapsed by default.** The disclosure starts closed and is a real `<details>`-style button +
 *    region pair, so it is reachable and operable by keyboard and announces its own state without animation.
 */

const STATUS_LABEL_KEY = {
  'not-evaluated': 'kundali.remedies.status.notEvaluated',
  withheld: 'kundali.remedies.status.withheld',
  'unknown-code': 'kundali.remedies.status.unknownCode',
  evaluated: 'kundali.remedies.status.evaluated',
} as const;

export function RemediesSection({ section }: { section: KundaliRemediesSection }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const titleId = useId();

  const renderable = remediesThatMayRender(section);
  const suppressed = remediesSuppressedByStatus(section);
  const empty = renderable.length === 0 && suppressed.length === 0 && section.unsupported.length === 0;

  return (
    <section className={styles.section} aria-labelledby={titleId} data-testid="remedies-section">
      <h2 className={styles.title} id={titleId}>
        {t('kundali.remedies.title')}
      </h2>
      <p className={styles.intro}>{t('kundali.remedies.intro')}</p>

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? t('kundali.remedies.hide') : t('kundali.remedies.show')}
      </button>

      {open && (
        <div className={styles.body} id={bodyId} data-testid="remedies-body">
          <p className={styles.version}>
            {t('kundali.remedies.catalogVersion', { version: section.catalogVersion })}
          </p>

          {empty ? (
            <p className={styles.empty} data-testid="remedies-empty">
              {t('kundali.remedies.noneApply')}
            </p>
          ) : (
            <>
              {renderable.length > 0 && (
                <ul className={styles.list} data-testid="remedies-list">
                  {renderable.map((remedy) => (
                    <li
                      key={`${remedy.findingCode}-${remedy.category}`}
                      className={styles.item}
                      data-testid={`remedy-${remedy.findingCode}`}
                    >
                      <h3 className={styles.itemTitle}>{remedy.suggestion}</h3>
                      <dl className={styles.facts}>
                        <div className={styles.fact}>
                          <dt>{t('kundali.remedies.finding')}</dt>
                          <dd>
                            <code className={styles.code}>{remedy.findingCode}</code>
                          </dd>
                        </div>
                        <div className={styles.fact}>
                          <dt>{t('kundali.remedies.category')}</dt>
                          <dd>{remedy.category}</dd>
                        </div>
                        <div className={styles.fact}>
                          <dt>{t('kundali.remedies.tradition')}</dt>
                          <dd>{remedy.tradition}</dd>
                        </div>
                        <div className={styles.fact}>
                          <dt>{t('kundali.remedies.reference')}</dt>
                          <dd>{remedy.reference}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}

              {renderable.length === 0 && (
                <p className={styles.empty}>{t('kundali.remedies.noneForFindings')}</p>
              )}

              {suppressed.length > 0 && (
                <div className={styles.suppressed} data-testid="remedies-suppressed">
                  <h3 className={styles.subTitle}>{t('kundali.remedies.suppressedTitle')}</h3>
                  <p className={styles.note}>{t('kundali.remedies.suppressedNote')}</p>
                  <ul className={styles.unsupportedList}>
                    {suppressed.map(({ remedy, status }) => (
                      <li key={`suppressed-${remedy.findingCode}`}>
                        {t('kundali.remedies.suppressedItem', {
                          finding: remedy.findingCode,
                          status: t(STATUS_LABEL_KEY[parseRemedyFindingStatus(status)]),
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {section.unsupported.length > 0 && (
                <div className={styles.suppressed} data-testid="remedies-unsupported">
                  <h3 className={styles.subTitle}>{t('kundali.remedies.unsupportedTitle')}</h3>
                  <ul className={styles.unsupportedList}>
                    {section.unsupported.map((entry) => (
                      <li key={`${entry.path}-${entry.reason}`}>
                        {t('kundali.remedies.unsupportedItem', { path: entry.path, reason: entry.reason })}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <p className={styles.disclaimer}>{t('kundali.remedies.disclaimer')}</p>
        </div>
      )}
    </section>
  );
}
