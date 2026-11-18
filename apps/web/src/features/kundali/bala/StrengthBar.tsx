import type { ComponentState, ShadbalaEntry } from '@myvedicstar/contracts';

import { useTranslation, useTranslator } from '../../../shared/i18n/I18nProvider';
import styles from './Bala.module.css';

/**
 * Vocabulary for Shadbala component names.
 *
 * Identifiers come from the server's rule set, so they are resolved at runtime through tDynamic with a fallback: a
 * component the catalog does not know renders as a neutral label rather than a raw token.
 */
export function componentLabel(t: ReturnType<typeof useTranslator>, component: string): string {
  return t.tDynamic(
    `kundali.bala.component.${component.toLowerCase()}`,
    undefined,
    t.t('kundali.bala.componentUnknown'),
  );
}

/**
 * How one component value must be rendered.
 *
 * `withheld` and `placeholder` have NO numeric representation here, and that is the point: the type carries the reason
 * a number is absent, so a renderer cannot print 0 for a value that is not a measurement.
 */
export type ComponentView =
  | { kind: 'value'; value: number; label: string }
  | { kind: 'withheld'; label: string }
  | { kind: 'placeholder'; label: string };

/** Maps one component to its view, using the state the engine supplied. Not inferred from the number. */
export function componentView(
  entry: ShadbalaEntry,
  component: string,
  state: ComponentState | undefined,
  label: string,
): ComponentView {
  const value = entry.components[component];
  // An unknown state for a present value is treated as not-a-measurement: printing it would be the exact error this
  // section exists to prevent. The schema already rejects this payload; this is the render-time backstop.
  if (state === 'placeholder') return { kind: 'placeholder', label };
  if (state !== 'computed') return { kind: 'withheld', label };
  return { kind: 'value', value: value ?? 0, label };
}

/**
 * One strength bar, with the numeric value and its qualify-ing state rendered beside it.
 *
 * The bar is decorative and aria-hidden; the accessible content is the text beside it, so the chart never carries
 * information the table does not.
 */
export function StrengthBar({
  label,
  value,
  max,
  unit,
  ratio,
  missing,
  excludeNote,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  ratio: number | undefined;
  /** Classical components the total does not include. Empty only when the total is complete. */
  missing: readonly string[];
  /** Extra sentence naming components excluded from the total for another reason (e.g. a placeholder). */
  excludeNote: string | undefined;
}) {
  const { t } = useTranslation();
  const translator = useTranslator();

  // A non-positive max would paint every bar full, which reads as "all strong".
  const scale = max > 0 ? max : 1;
  const percent = Math.max(0, Math.min(100, (value / scale) * 100));
  const partial = missing.length > 0;

  return (
    <div className={styles.barRow} data-completeness={partial ? 'partial' : 'complete'}>
      <span className={styles.barLabel}>{label}</span>
      <span className={styles.barTrack} aria-hidden="true">
        <span className={styles.barFill} style={{ inlineSize: `${percent}%` }} />
      </span>
      <span className={styles.barValue}>
        {t('kundali.bala.valueWithUnit', { value, unit })}
        {ratio !== undefined && <span className={styles.ratio}> {t('kundali.bala.ratio', { ratio })}</span>}
      </span>
      {partial && (
        // The qualifier sits on the SAME line as the number, naming the component: a reader scanning the value meets
        // the caveat at the same moment, not in a footnote they may never reach.
        <span className={styles.partialNote} data-testid={`partial-${label}`}>
          {t('kundali.bala.partialTotal', {
            components: missing.map((component) => componentLabel(translator, component)).join(', '),
          })}
        </span>
      )}
      {excludeNote && (
        <span className={styles.excludeNote} data-testid={`excluded-${label}`}>
          {excludeNote}
        </span>
      )}
    </div>
  );
}
