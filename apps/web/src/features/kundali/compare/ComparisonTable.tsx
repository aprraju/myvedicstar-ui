import { useId } from 'react';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Compare.module.css';
import {
  type ComparisonCategory,
  comparisonTotal,
  type ComparisonView,
  indeterminateReasonKey,
  isScored,
} from './comparisonAdapter';

/**
 * KUN-15 Ashtakoota comparison table.
 *
 * Rules this component enforces, and where each one lives:
 *
 * 1. **Indeterminacy is its own state, never a zero.** `CategoryScore` is a closed union, so a category with no score
 *    has no numeric field at all — there is nothing to render as 0, and a renderer cannot invent one with `?? 0`.
 *    The floor of this rule is a test (`an indeterminate category never renders a zero score`), not a convention.
 * 2. **The reason is named.** An indeterminate row states why, using the reason vocabulary, because "cannot be
 *    determined" without a cause is a shrug where the user needs an explanation.
 * 3. **The total is withheld, not shrunk.** When any category is indeterminate `comparisonTotal` returns null, and the
 *    total row says so. A total over only the scored categories would be a number the engine never produced.
 * 4. **No verdict.** Scores are shown as scores out of their maximum; the owner decision on #40 is scores without a
 *    pass/fail verdict, and this table does not add one.
 */
export function ComparisonTable({
  comparison,
  labelA,
  labelB,
}: {
  comparison: ComparisonView;
  labelA: string;
  labelB: string;
}) {
  const { t } = useTranslation();
  const captionId = useId();
  const total = comparisonTotal(comparison.categories);

  return (
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={t('kundali.compare.tableLabel')}>
      <table className={styles.table} data-testid="comparison-table">
        <caption className="visually-hidden" id={captionId}>
          {t('kundali.compare.caption', { a: labelA, b: labelB })}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t('kundali.compare.column.category')}</th>
            <th scope="col">{t('kundali.compare.column.score')}</th>
          </tr>
        </thead>
        <tbody>
          {comparison.categories.map((category) => (
            <CategoryRow key={category.code} category={category} />
          ))}
        </tbody>
        <tfoot>
          <tr data-testid="comparison-total" data-state={total === null ? 'indeterminate' : 'scored'}>
            <th scope="row">{t('kundali.compare.total')}</th>
            <td>
              {total === null ? (
                <span className={styles.indeterminate}>{t('kundali.compare.totalIndeterminate')}</span>
              ) : (
                t('kundali.compare.scoreOf', { score: total, max: comparison.scoredMax })
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** One category row. Scored and indeterminate are different nodes, not one node with a conditional value. */
function CategoryRow({ category }: { category: ComparisonCategory }) {
  const { t } = useTranslation();
  const label = t(`kundali.compare.category.${category.code}` as never);

  if (!isScored(category.score)) {
    return (
      <tr data-testid={`comparison-row-${category.code}`} data-state="indeterminate">
        <th scope="row">{label}</th>
        <td>
          <span className={styles.indeterminate}>
            {t('kundali.compare.cannotDetermine', {
              reason: t(indeterminateReasonKey(category.score.reason)),
            })}
          </span>
        </td>
      </tr>
    );
  }

  return (
    <tr data-testid={`comparison-row-${category.code}`} data-state="scored">
      <th scope="row">{label}</th>
      <td>{t('kundali.compare.scoreOf', { score: category.score.score, max: category.score.max })}</td>
    </tr>
  );
}

/**
 * The section shell.
 *
 * It renders the comparison when the adapter produced one, and states plainly that the comparison is unavailable when
 * the adapter returns `contract-not-available`. Note what it does NOT do: there is no fallback table, no empty scores
 * and no "0 of 36" — an unavailable comparison and a comparison of zero are different claims, and only one of them is
 * true here.
 */
export function ComparisonSection({ withLabels }: { withLabels: { a: string; b: string } }) {
  const { t } = useTranslation();

  return (
    <section className={styles.section} aria-labelledby="kundali-compare-title" data-testid="compare-section">
      <h2 className={styles.title} id="kundali-compare-title">
        {t('kundali.compare.title', { a: withLabels.a, b: withLabels.b })}
      </h2>
      <p className={styles.unavailable} data-testid="compare-contract-unavailable" role="status">
        {t('kundali.compare.contractUnavailable')}
      </p>
    </section>
  );
}
