import { useId } from 'react';

import { useTranslation } from '../../shared/i18n/I18nProvider';
import styles from './Kundali.module.css';

interface ProfileSelectorOption {
  id: string;
  name: string;
}

export interface ProfileSelectorProps {
  options: readonly ProfileSelectorOption[];
  /** Currently selected profile id, or null when nothing is carried in the URL. */
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/**
 * A native <select> for choosing which Astro Profile the Kundali is for. A native control keeps keyboard, screen
 * reader and mobile behaviour correct for free; the visible label is a real <label for>, and the hint is wired through
 * aria-describedby so the purpose is announced with the control.
 */
export function ProfileSelector({ options, value, onChange, disabled = false }: ProfileSelectorProps) {
  const { t } = useTranslation();
  const selectId = useId();
  const hintId = useId();

  return (
    <div className={styles.selector}>
      <label className={styles.label} htmlFor={selectId}>
        {t('kundali.profileLabel')}
      </label>
      <p className={styles.hint} id={hintId}>
        {t('kundali.profileSelectHint')}
      </p>
      <select
        id={selectId}
        className={styles.control}
        value={value ?? ''}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.target.value)}
      >
        {/* Distinct from the hint above: the hint explains the control, this labels the empty choice. */}
        {value === null && <option value="">{t('kundali.profileSelectPlaceholder')}</option>}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
