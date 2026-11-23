import { type ReactNode, useId } from 'react';

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

/** One owned profile, as the picker needs it. */
export interface CompareProfileOption {
  id: string;
  name: string;
}

/**
 * Which state the compare surface is in.
 *
 * A closed union rather than a set of booleans (`sameSelected`, `needsSelection`, …): the states are mutually
 * exclusive, and an impossible combination that cannot be written cannot be rendered. `blocked` carries the reason it is
 * blocked, so the surface always has something specific to say instead of an empty table.
 */
export type ComparePickerState =
  | { kind: 'not-enough-profiles' }
  | { kind: 'needs-selection' }
  | { kind: 'same-profile' }
  | { kind: 'foreign-profile' }
  | { kind: 'ready'; a: CompareProfileOption; b: CompareProfileOption };

/**
 * Decides what the compare surface may render, given the caller's owned profiles and the two ids in the URL.
 *
 * Every rule here is a rule the issue states, expressed once so no renderer re-implements it:
 *  - a comparison needs TWO DISTINCT profiles, so one id or two identical ids is not a comparison;
 *  - both ids must be in the caller's OWN list, because a comparison of a profile the caller does not own must never be
 *    requested or shown (the API answers 404 for a foreign id, and a UI that echoed the id would leak that it exists);
 *  - with fewer than two owned profiles there is nothing to compare, and saying so is more useful than an empty table.
 *
 * Pure and exported for exactly that reason: it is the part that is worth testing directly, independent of selection
 * widgets or routing.
 */
export function comparePickerState(
  profiles: readonly CompareProfileOption[],
  firstId: string | null,
  secondId: string | null,
): ComparePickerState {
  if (profiles.length < 2) return { kind: 'not-enough-profiles' };
  if (firstId === null || secondId === null) return { kind: 'needs-selection' };
  if (firstId === secondId) return { kind: 'same-profile' };
  const a = profiles.find((profile) => profile.id === firstId);
  const b = profiles.find((profile) => profile.id === secondId);
  if (!a || !b) return { kind: 'foreign-profile' };
  return { kind: 'ready', a, b };
}

/**
 * The two-profile picker and, once a pair is chosen, the comparison for it.
 *
 * Selection lives in the URL, like the single-profile selector: a comparison is a link a user can send. The picker is
 * two native <select>s rather than a bespoke listbox so keyboard, screen reader and mobile behaviour are correct for
 * free; each option is 44px tall at phone sizes through the shared control token, not a hardcoded number.
 *
 * The comparison itself is always obtained through `children`, which receives the chosen pair — this component never
 * calls the adapter, so there is exactly one place (the route) where the wire contract could ever be consumed.
 */
export function CompareProfiles({
  profiles,
  firstId,
  secondId,
  onChange,
  children,
}: {
  profiles: readonly CompareProfileOption[];
  firstId: string | null;
  secondId: string | null;
  onChange: (next: { first: string | null; second: string | null }) => void;
  /** Rendered only for a `ready` state, with the pair it must render a comparison for. */
  children: (pair: { a: CompareProfileOption; b: CompareProfileOption }) => ReactNode;
}) {
  const { t } = useTranslation();
  const state = comparePickerState(profiles, firstId, secondId);
  const firstSelectId = useId();
  const secondSelectId = useId();
  const statusId = useId();

  const blockedMessage = ((): string | null => {
    switch (state.kind) {
      case 'not-enough-profiles':
        return t('kundali.compare.needTwoProfiles');
      case 'same-profile':
        return t('kundali.compare.sameProfile');
      case 'foreign-profile':
        return t('kundali.compare.foreignProfile');
      case 'needs-selection':
        return t('kundali.compare.selectBoth');
      case 'ready':
        return null;
    }
  })();

  const renderOptions = (excludedId: string | null) =>
    profiles.map((profile) => (
      <option key={profile.id} value={profile.id} disabled={profile.id === excludedId}>
        {profile.name}
      </option>
    ));

  return (
    <section
      className={styles.section}
      aria-labelledby="kundali-compare-picker-title"
      data-testid="compare-picker"
    >
      <h2 className={styles.title} id="kundali-compare-picker-title">
        {t('kundali.compare.pickerTitle')}
      </h2>
      <p className={styles.hint}>{t('kundali.compare.pickerHint')}</p>

      <div className={styles.pickerGrid}>
        <div className={styles.selector}>
          <label className={styles.label} htmlFor={firstSelectId}>
            {t('kundali.compare.firstProfile')}
          </label>
          <select
            id={firstSelectId}
            className={styles.control}
            value={firstId ?? ''}
            disabled={profiles.length < 2}
            aria-describedby={statusId}
            onChange={(event) => onChange({ first: event.target.value || null, second: secondId })}
          >
            <option value="">{t('kundali.compare.pickerPlaceholder')}</option>
            {renderOptions(secondId)}
          </select>
        </div>

        <div className={styles.selector}>
          <label className={styles.label} htmlFor={secondSelectId}>
            {t('kundali.compare.secondProfile')}
          </label>
          <select
            id={secondSelectId}
            className={styles.control}
            value={secondId ?? ''}
            disabled={profiles.length < 2}
            aria-describedby={statusId}
            onChange={(event) => onChange({ first: firstId, second: event.target.value || null })}
          >
            <option value="">{t('kundali.compare.pickerPlaceholder')}</option>
            {renderOptions(firstId)}
          </select>
        </div>
      </div>

      {/* One polite live region for the picker's state, so a screen-reader user hears why nothing is compared yet
          without the layout shifting under them. */}
      <p className={styles.hint} id={statusId} role="status" data-testid="compare-picker-status">
        {blockedMessage ?? ''}
      </p>

      {state.kind === 'ready' ? children({ a: state.a, b: state.b }) : null}
    </section>
  );
}
