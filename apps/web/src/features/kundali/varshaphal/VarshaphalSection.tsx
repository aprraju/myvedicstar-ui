import { type varshaphalState } from '@myvedicstar/contracts';
import { useId } from 'react';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import { reasonKey } from '../reasonText';
import styles from './VarshaphalSection.module.css';

/**
 * KUN-14 Varshaphal — the honest shell (ui#123).
 *
 * The engine has no Varshaphal, so the day-one render is a capability-gap statement with the server's reason code. The
 * design constraint is negative and absolute: **this component must never draw an annual chart it was not given.** So it
 * takes the resolved `VarshaphalState`, not a raw payload, and the chart branch is the only place a chart is read — a
 * component that cannot reach a value cannot print one.
 *
 * There is deliberately no "estimated" mode, no partial table, no "coming soon" grid of blank cells. A blank cell in a
 * chart is read as a value that happens to be missing; a sentence saying the engine cannot compute this is read as what
 * it is.
 */
export function VarshaphalSection({
  title,
  state,
}: {
  title: string;
  state: ReturnType<typeof varshaphalState>;
}) {
  const { t } = useTranslation();
  // The host renders the loading and error shells as `section`s, but hands the ready payload straight to this renderer.
  // Owning the section element here keeps the region name identical across all three states, so a user (and a screen
  // reader) never sees the section boundary appear and disappear with the load.
  const titleId = useId();

  if (state.kind === 'chart') {
    const { chart } = state;
    return (
      <section className={styles.section} aria-labelledby={titleId}>
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        <p className={styles.summary}>{t('kundali.varshaphal.annualYear', { year: chart.annualYear })}</p>
        <table className={styles.table}>
          <caption className={styles.caption}>{t('kundali.varshaphal.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('kundali.varshaphal.column.path')}</th>
              <th scope="col">{t('kundali.varshaphal.column.value')}</th>
            </tr>
          </thead>
          <tbody>
            {chart.values.map((entry) => (
              <tr key={entry.path}>
                <th scope="row">{entry.path}</th>
                <td>{entry.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {chart.withheld.length > 0 && (
          <ul className={styles.withheld} aria-label={t('kundali.varshaphal.withheld.label')}>
            {chart.withheld.map((entry) => (
              <li key={entry.path}>
                {t('kundali.varshaphal.withheld.item', {
                  path: entry.path,
                  reason: t(reasonKey(entry.reason)),
                })}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // Both remaining states are gaps: the engine cannot produce this section, or it has not answered yet. Neither carries a
  // chart, and neither is worded as "no results" — a missing annual chart is not an empty one.
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h2 className={styles.title} id={titleId}>
        {title}
      </h2>
      <p className={styles.gap} data-varshaphal-state={state.kind}>
        {state.kind === 'capability-gap'
          ? t('kundali.varshaphal.capabilityGap', { reason: t(reasonKey(state.reason)) })
          : t('kundali.varshaphal.unavailable')}
      </p>
    </section>
  );
}
