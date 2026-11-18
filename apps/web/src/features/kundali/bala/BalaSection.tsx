import {
  CLASSICAL_SHADBALA_COMPONENTS,
  completenessOf,
  type KundaliBala,
  type ShadbalaEntry,
} from '@myvedicstar/contracts';
import type { Translator } from '@myvedicstar/localization';

import { useTranslation, useTranslator } from '../../../shared/i18n/I18nProvider';
import { AssessmentSection } from '../assessment/AssessmentSection';
import styles from './Bala.module.css';
import { componentLabel, componentView, StrengthBar } from './StrengthBar';

/**
 * KUN-12: Shadbala and Bhava Bala.
 *
 * Rules this section enforces, and where each one lives:
 *
 * 1. **Dig Bala is a placeholder, not a 0.0.** `componentStates` says which components are measurements; a placeholder
 *    renders as a labelled dash with the reason, never as a number. The numeric value the engine sends for a
 *    placeholder is deliberately not rendered anywhere.
 * 2. **A partial total is never printed as a complete one.** Completeness is derived from `componentsInTotal` against
 *    the classical six, and the caveat naming the missing component sits on the same row as the total.
 * 3. **The total is the engine's number.** Nothing here sums components; the only arithmetic is bar scaling, which is
 *    presentational and capped.
 * 4. **Shadbala and Bhava Bala stay separate.** Different subsections, different tables, no combined score.
 */
export function BalaSection({ section }: { section: KundaliBala }) {
  const { t } = useTranslation();
  const translator = useTranslator();

  const shadbalaMax = Math.max(...section.shadbala.map((entry) => entry.total), 0);
  const bhavaMax = Math.max(...section.bhavaBala.map((entry) => entry.total), 0);

  // Component columns are the union across planets, so a planet missing a component leaves a gap in its own column
  // rather than shifting every later component leftwards under the wrong header.
  const componentColumns = section.shadbala.reduce<string[]>((columns, entry) => {
    for (const component of Object.keys(entry.components)) {
      if (!columns.includes(component)) columns.push(component);
    }
    return columns;
  }, []);
  const orderedColumns = [
    ...CLASSICAL_SHADBALA_COMPONENTS.filter((component) => componentColumns.includes(component)),
    ...componentColumns.filter(
      (component) => !(CLASSICAL_SHADBALA_COMPONENTS as readonly string[]).includes(component),
    ),
  ];

  return (
    <AssessmentSection
      state={{ availability: 'computed' }}
      titleId="kundali-bala-heading"
      title={t('kundali.bala.title')}
      intro={t('kundali.bala.intro')}
      footer={
        <p className={styles.rules}>
          {t('kundali.bala.rulesVersion', { version: section.rulesVersion, unit: section.unit })}
          {!section.complete && ` ${t('kundali.bala.sectionPartial')}`}
        </p>
      }
    >
      {() => (
        <>
          <section className={styles.subsection} aria-labelledby="kundali-shadbala-heading">
            <h3 className={styles.subTitle} id="kundali-shadbala-heading">
              {t('kundali.bala.shadbalaTitle')}
            </h3>

            {section.shadbala.length === 0 ? (
              <p className={styles.empty}>{t('kundali.bala.noPlanets')}</p>
            ) : (
              <>
                <div className={styles.chart} data-testid="shadbala-chart">
                  {section.shadbala.map((entry) => {
                    const completeness = completenessOf(entry);
                    return (
                      <StrengthBar
                        key={entry.planet}
                        label={entry.planet}
                        value={entry.total}
                        max={shadbalaMax}
                        unit={section.unit}
                        ratio={entry.ratioToThreshold}
                        missing={completeness.kind === 'partial' ? completeness.missing : []}
                        excludeNote={excludedNote(entry, translator, t)}
                      />
                    );
                  })}
                </div>

                <div
                  className={styles.tableWrap}
                  tabIndex={0}
                  role="region"
                  aria-label={t('kundali.bala.shadbalaTableLabel')}
                >
                  <table className={styles.table} data-testid="shadbala-table">
                    <caption className="visually-hidden">{t('kundali.bala.shadbalaCaption')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('kundali.bala.column.planet')}</th>
                        {orderedColumns.map((component) => (
                          <th key={component} scope="col">
                            {componentLabel(translator, component)}
                          </th>
                        ))}
                        <th scope="col">{t('kundali.bala.column.total')}</th>
                        <th scope="col">{t('kundali.bala.column.completeness')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.shadbala.map((entry) => {
                        const completeness = completenessOf(entry);
                        return (
                          <tr key={entry.planet} data-testid={`shadbala-row-${entry.planet}`}>
                            <th scope="row">{entry.planet}</th>
                            {orderedColumns.map((component) => {
                              const view = componentView(
                                entry,
                                component,
                                entry.componentStates[component],
                                componentLabel(translator, component),
                              );
                              return (
                                <td
                                  key={component}
                                  data-state={view.kind}
                                  data-testid={`cell-${entry.planet}-${component}`}
                                >
                                  {view.kind === 'value' ? (
                                    view.value
                                  ) : (
                                    // A withheld or placeholder component is NAMED as such in the cell. It never shows
                                    // the numeric value the engine sent for shape, which would read as a measurement.
                                    <span className={styles.notMeasured}>
                                      {view.kind === 'placeholder'
                                        ? t('kundali.bala.placeholderCell')
                                        : t('kundali.bala.withheldCell')}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            <td>
                              {t('kundali.bala.valueWithUnit', { value: entry.total, unit: section.unit })}
                            </td>
                            <td data-state={completeness.kind}>
                              {completeness.kind === 'complete' ? (
                                t('kundali.bala.complete')
                              ) : (
                                <span className={styles.partialNote}>
                                  {t('kundali.bala.partialTotal', {
                                    components: completeness.missing
                                      .map((component) => componentLabel(translator, component))
                                      .join(', '),
                                  })}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {/* Separate subsection and separate table. Bhava Bala is a different measure and has no shared total with
              Shadbala, which is the story's explicit requirement. */}
          <section className={styles.subsection} aria-labelledby="kundali-bhava-heading">
            <h3 className={styles.subTitle} id="kundali-bhava-heading">
              {t('kundali.bala.bhavaTitle')}
            </h3>
            {section.bhavaBala.length === 0 ? (
              <p className={styles.empty}>{t('kundali.bala.noHouses')}</p>
            ) : (
              <>
                <div
                  className={styles.tableWrap}
                  tabIndex={0}
                  role="region"
                  aria-label={t('kundali.bala.bhavaTableLabel')}
                >
                  <table className={styles.table} data-testid="bhava-table">
                    <caption className="visually-hidden">{t('kundali.bala.bhavaCaption')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('kundali.bala.column.house')}</th>
                        <th scope="col">{t('kundali.bala.column.total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.bhavaBala.map((entry) => (
                        <tr key={entry.house}>
                          <th scope="row">{t('kundali.bala.house', { house: entry.house })}</th>
                          <td>
                            {t('kundali.bala.valueWithUnit', { value: entry.total, unit: section.unit })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.chart} data-testid="bhava-chart">
                  {section.bhavaBala.map((entry) => (
                    <StrengthBar
                      key={entry.house}
                      label={t('kundali.bala.house', { house: entry.house })}
                      value={entry.total}
                      max={bhavaMax}
                      unit={section.unit}
                      ratio={undefined}
                      missing={[]}
                      excludeNote={undefined}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </AssessmentSection>
  );
}

/**
 * One sentence naming the components that are present in the breakdown but excluded from the total.
 *
 * Dig is the live case: a placeholder zero that contributes no strength. Saying so once per planet is what stops the
 * total being read as a five-of-six measurement.
 */
function excludedNote(
  entry: ShadbalaEntry,
  translator: Translator,
  t: (key: 'kundali.bala.excludedFromTotal', params: { components: string }) => string,
): string | undefined {
  if (entry.componentsExcludedFromTotal.length === 0) return undefined;
  const names = entry.componentsExcludedFromTotal
    .map((component) => componentLabel(translator, component))
    .join(', ');
  return t('kundali.bala.excludedFromTotal', { components: names });
}
