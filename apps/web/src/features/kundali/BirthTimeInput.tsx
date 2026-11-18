import { useId } from 'react';

import { useTranslation } from '../../shared/i18n/I18nProvider';
import type { BirthTimeError } from './birth-time-write';
import styles from './Kundali.module.css';

export type BirthTimeModeChoice = 'exact' | 'approximate' | 'unknown';

export interface BirthTimeInputProps {
  mode: BirthTimeModeChoice;
  from: string;
  to: string;
  error: BirthTimeError | null;
  onChange: (next: { mode: BirthTimeModeChoice; from: string; to: string }) => void;
  disabled?: boolean;
}

/**
 * KUN-06 birth-time INPUT: the mode is a first-class choice the user makes, never a defaulted field.
 *
 * Accessibility is built in rather than retrofitted:
 *  - a real <fieldset>/<legend> groups the radios, and each radio is a native input, so arrow-key movement and
 *    "1 of 3" announcements come from the platform instead of being reimplemented;
 *  - an invalid time field gets aria-invalid and is described by the error text via aria-describedby;
 *  - errors are mirrored into a single role="alert" region so they are announced when they appear, without moving
 *    focus away from the field the user is correcting.
 *
 * `unknown` renders NO time inputs at all, so there is nothing to leave a stale value in.
 */
export function BirthTimeInput({ mode, from, to, error, onChange, disabled = false }: BirthTimeInputProps) {
  const { t } = useTranslation();
  const legendId = useId();
  const hintId = useId();
  const fromErrorId = useId();
  const toErrorId = useId();

  const errorMessage = (() => {
    if (!error) return null;
    if (error.code === 'window-crosses-midnight') return t('kundali.birthTime.error.crossesMidnight');
    if (error.code === 'range-not-ascending') return t('kundali.birthTime.error.notAscending');
    return error.field === 'to'
      ? t('kundali.birthTime.error.invalidTo')
      : t('kundali.birthTime.error.invalidFrom');
  })();

  const fromInvalid =
    error?.code === 'range-not-ascending' || error?.code === 'window-crosses-midnight'
      ? false
      : error?.code === 'invalid-time' && error.field === 'from';
  const toInvalid =
    error?.code === 'range-not-ascending' || error?.code === 'window-crosses-midnight'
      ? true
      : error?.code === 'invalid-time' && error.field === 'to';

  return (
    <fieldset className={styles.fieldset} aria-describedby={hintId}>
      <legend className={styles.legend} id={legendId}>
        {t('kundali.birthTime.legend')}
      </legend>
      <p className={styles.hint} id={hintId}>
        {t('kundali.birthTime.hint')}
      </p>

      <div className={styles.modes}>
        {(['exact', 'approximate', 'unknown'] as const).map((option) => (
          <label key={option} className={styles.modeOption}>
            <input
              type="radio"
              name="kundali-birth-time-mode"
              value={option}
              checked={mode === option}
              disabled={disabled}
              onChange={() => onChange({ mode: option, from: '', to: '' })}
            />
            <span>{t(`kundali.birthTime.mode.${option}`)}</span>
          </label>
        ))}
      </div>

      {mode === 'exact' && (
        <div className={styles.timeRow}>
          <label className={styles.field}>
            <span className={styles.label}>{t('kundali.birthTime.exactLabel')}</span>
            <input
              type="time"
              step="1"
              className={styles.input}
              value={from}
              disabled={disabled}
              aria-invalid={fromInvalid || undefined}
              aria-describedby={fromInvalid && errorMessage ? fromErrorId : undefined}
              onChange={(event) => onChange({ mode, from: event.target.value, to: '' })}
            />
          </label>
        </div>
      )}

      {mode === 'approximate' && (
        <div className={styles.timeRow}>
          <label className={styles.field}>
            <span className={styles.label}>{t('kundali.birthTime.fromLabel')}</span>
            <input
              type="time"
              step="1"
              className={styles.input}
              value={from}
              disabled={disabled}
              aria-invalid={fromInvalid || undefined}
              aria-describedby={fromInvalid && errorMessage ? fromErrorId : undefined}
              onChange={(event) => onChange({ mode, from: event.target.value, to })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t('kundali.birthTime.toLabel')}</span>
            <input
              type="time"
              step="1"
              className={styles.input}
              value={to}
              disabled={disabled}
              aria-invalid={toInvalid || undefined}
              aria-describedby={toInvalid && errorMessage ? toErrorId : undefined}
              onChange={(event) => onChange({ mode, from, to: event.target.value })}
            />
          </label>
        </div>
      )}

      {mode === 'unknown' && <p className={styles.hint}>{t('kundali.birthTime.unknownHint')}</p>}

      {/* Live region: present only while there is an error, so it announces on appearance and stays quiet otherwise. */}
      {errorMessage && (
        <p className={styles.error} role="alert">
          <span id={fromInvalid ? fromErrorId : toErrorId}>{errorMessage}</span>
        </p>
      )}
    </fieldset>
  );
}
