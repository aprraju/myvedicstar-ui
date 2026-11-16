import { useTranslation } from '../../shared/i18n/I18nProvider';
import styles from './BirthTimeField.module.css';

/** How the birth time was supplied. Chosen before the time itself, because it decides what the field means. */
export type BirthTimeMode = 'known' | 'approximate' | 'unknown';

export interface BirthTimeValue {
  mode: BirthTimeMode;
  /** HH:MM:SS, 24-hour. Empty when the mode does not use it. */
  from: string;
  /** Optional end of the window for an approximate time. Empty when unused. */
  to: string;
}

export const EMPTY_BIRTH_TIME: BirthTimeValue = { mode: 'known', from: '', to: '' };

/** The parts of a draft that decide whether Save may be pressed. Testable without rendering the page. */
export interface SavableDraft {
  name: string;
  occupation: string;
  relationship: string;
  customRelationship: string;
}

/** Occupation is mandatory: Save stays disabled while it is blank (owner decision, #28). */
export function isDraftSavable(draft: SavableDraft): boolean {
  const nameOk = draft.name.trim().length > 0;
  const occupationOk = draft.occupation.trim().length > 0;
  // "Other" is not a relationship on its own: it needs the free-text value.
  const relationshipOk = draft.relationship !== 'other' || draft.customRelationship.trim().length > 0;
  return nameOk && occupationOk && relationshipOk;
}

/**
 * Switching mode discards anything the new mode cannot represent. Keeping the old value would silently save a time the
 * user has just said they do not know — the reason this is pure state logic rather than inline JSX.
 */
export function changeBirthTimeMode(current: BirthTimeValue, mode: BirthTimeMode): BirthTimeValue {
  if (mode === current.mode) return current;
  if (mode === 'known') return { mode, from: '', to: '' };
  if (mode === 'approximate') return { mode, from: current.from, to: '' };
  // unknown: the user has just told us there is no time to record.
  return { mode, from: '', to: '' };
}

interface BirthTimeFieldProps {
  value: BirthTimeValue;
  onChange: (next: BirthTimeValue) => void;
  disabled?: boolean;
  /** Shown under the control; the Unknown option explains what is still calculated without a time. */
  hintId?: string;
}

/**
 * Birth Time as three explicit states. Presentational only: no persistence, no API calls — the save contract for this
 * field is still being agreed (see issue #28).
 */
export function BirthTimeField({ value, onChange, disabled = false, hintId }: BirthTimeFieldProps) {
  const { t } = useTranslation();

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t('vedicProfiles.form.birthTime')}</legend>
      <div className={styles.modes} role="radiogroup" aria-describedby={hintId}>
        {(['known', 'approximate', 'unknown'] as const).map((mode) => (
          <label key={mode} className={styles.modeOption}>
            <input
              type="radio"
              name="birth-time-mode"
              value={mode}
              checked={value.mode === mode}
              disabled={disabled}
              onChange={() => onChange(changeBirthTimeMode(value, mode))}
            />
            <span>{t(`vedicProfiles.form.birthTimeMode.${mode}`)}</span>
          </label>
        ))}
      </div>

      {value.mode === 'known' && (
        <div className={styles.timeRow}>
          <label className={styles.field}>
            <span className={styles.label}>{t('vedicProfiles.form.birthTimeExact')}</span>
            <input
              type="time"
              step="1"
              className={styles.input}
              value={value.from}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
            />
          </label>
        </div>
      )}

      {value.mode === 'approximate' && (
        <div className={styles.timeRow}>
          <label className={styles.field}>
            <span className={styles.label}>{t('vedicProfiles.form.birthTimeFrom')}</span>
            <input
              type="time"
              step="1"
              className={styles.input}
              value={value.from}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t('vedicProfiles.form.birthTimeTo')}</span>
            <input
              type="time"
              step="1"
              className={styles.input}
              value={value.to}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
            />
          </label>
        </div>
      )}

      {value.mode === 'unknown' && (
        <p className={styles.hint}>{t('vedicProfiles.form.birthTimeUnknownHint')}</p>
      )}
    </fieldset>
  );
}
