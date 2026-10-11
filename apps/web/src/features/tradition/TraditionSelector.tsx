import { useId } from 'react';

import { useAuth } from '../../shared/auth';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import styles from './TraditionSelector.module.css';
import { useTradition, useTraditions } from './TraditionStateProvider';

/**
 * Native, labelled <select>: keyboard, screen-reader and touch friendly on every platform without custom widgets.
 * While the list loads (or if it fails) the current choice stays visible and usable.
 */
export function TraditionSelector({ showHint = false }: { showHint?: boolean }) {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const { tradition, setTradition } = useTradition();
  const { data, isError, isFetching } = useTraditions();
  const id = useId();
  const hintId = useId();

  const options = data?.traditions ?? [{ key: tradition, name: tradition, description: null }];
  const hasCurrent = options.some((o) => o.key === tradition);

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {t('tradition.label')}
      </label>
      <select
        id={id}
        className={styles.select}
        value={tradition}
        onChange={(event) => setTradition(event.target.value)}
        aria-describedby={showHint || isError ? hintId : undefined}
        disabled={!isAuthenticated || loading}
        aria-busy={isFetching || undefined}
      >
        {!hasCurrent && <option value={tradition}>{tradition}</option>}
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.name}
          </option>
        ))}
      </select>
      {(showHint || isError) && (
        <p id={hintId} className={styles.hint}>
          {isError ? t('tradition.loadFailed') : t('tradition.hint')}
        </p>
      )}
    </div>
  );
}
