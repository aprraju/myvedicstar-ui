import {
  divisionalState,
  type KundaliCapabilities,
  provisionalDivisions,
  supportedDivisions,
} from '@myvedicstar/contracts';

import { useTranslation } from '../../../shared/i18n/I18nProvider';
import styles from './Charts.module.css';

/**
 * The list of divisional charts a reader may choose, derived from the fetched capability boundary.
 *
 * This is the #111 behaviour change: the section previously offered whatever `divisionalChartValues` in the contract
 * package happened to list, which is a static union of every division the *engine is written to support*. That is not
 * the same statement as "this deployment computes it" — D60 is defined and returned, but only provisionally, and a
 * division the boundary omits is not computed at all. Offering all of them equally presented an unimplemented or
 * provisional result as definitive, which is the failure this boundary exists to prevent.
 *
 * Every option now carries the three-way state, so the label can say "provisional" rather than leaving the reader to
 * assume the chart is exact. Nothing here derives support from absence: a division missing from both lists is offered
 * as `absent`, and the UI can then skip or disable it deliberately rather than by accident.
 *
 * Note what this component does NOT do: it takes the boundary as a prop rather than fetching it. That keeps the
 * decision about what the engine can do in one place (the boundary), and keeps this component renderable in isolation
 * from any particular capability state — which is what makes the revert guard in the test meaningful.
 */

/** A division offered to the reader, with the boundary's verdict attached. */
export interface DivisionOption {
  /** The division as the contract names it, e.g. `D9`. */
  label: string;
  /** The numeric division used by `divisionalState`; `null` for entries that are not numeric divisions. */
  divisions: number | null;
  state: 'supported' | 'provisional' | 'absent';
}

/** The numeric division behind a contract label, or null when the label is not a numeric division. */
function divisionsOf(label: string): number | null {
  const match = /^D(\d+)$/.exec(label);
  return match ? Number(match[1]) : null;
}

/**
 * Derives the offered charts from the boundary.
 *
 * Ordering is supported, then provisional, then absent: a reader scanning the list meets the definitive results first,
 * and a provisional one is never adjacent to a supported one in a way that implies they are the same class.
 */
function divisionOptions(
  capabilities: KundaliCapabilities,
  labels: readonly string[],
): DivisionOption[] {
  const options = labels.map<DivisionOption>((label) => {
    const divisions = divisionsOf(label);
    if (divisions === null) {
      // A non-numeric division (BhavaChalit) has no entry in the boundary's numeric lists. It is reported absent
      // rather than assumed supported - the boundary is the only source of that answer, and it does not speak to it.
      return { label, divisions: null, state: 'absent' };
    }
    return { label, divisions, state: divisionalState(capabilities, divisions).kind };
  });

  const rank = { supported: 0, provisional: 1, absent: 2 } as const;
  return [...options].sort((a, b) => rank[a.state] - rank[b.state]);
}

export function DivisionPicker({
  capabilities,
  labels,
  selected,
  onSelect,
}: {
  capabilities: KundaliCapabilities;
  labels: readonly string[];
  selected: string | null;
  onSelect: (label: string) => void;
}) {
  const { t } = useTranslation();
  const options = divisionOptions(capabilities, labels);

  // The boundary's own lists, surfaced so the counts are visible rather than inferred from the option list.
  const supported = supportedDivisions(capabilities).length;
  const provisional = provisionalDivisions(capabilities).length;

  if (options.length === 0) {
    return <p className={styles.empty}>{t('kundali.charts.noDivisions')}</p>;
  }

  return (
    <fieldset className={styles.picker} data-testid="division-picker">
      <legend className={styles.pickerLegend}>{t('kundali.charts.pickerLegend')}</legend>
      <p className={styles.pickerSummary}>{t('kundali.charts.pickerSummary', { supported, provisional })}</p>
      <ul className={styles.pickerList}>
        {options.map((option) => (
          <li key={option.label}>
            <button
              type="button"
              className={styles.pickerOption}
              data-testid={`division-option-${option.label}`}
              data-state={option.state}
              aria-pressed={selected === option.label}
              onClick={() => onSelect(option.label)}
            >
              <span className={styles.pickerLabel}>{option.label}</span>
              {/* The state is said in words, never conveyed by styling alone. */}
              <span className={styles.pickerState}>{t(`kundali.charts.divisionState.${option.state}`)}</span>
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
