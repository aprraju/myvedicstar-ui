import type { SelectedLocation } from '@myvedicstar/domain-models';
import { useEffect, useRef } from 'react';

import { Icon } from '../../shared/components/Icon';
import { useTranslation } from '../../shared/i18n/I18nProvider';
import styles from './LocationSelector.module.css';
import { useLocationState } from './LocationStateProvider';

interface LocationSelectorProps {
  /**
   * Controlled mode: show this location instead of the app-global one. Supplying `onChange` also routes the shared
   * location dialog's selection here instead of to the header location, so a form can capture a birth location
   * without a second selector or a duplicate dialog. Omit both props for today's app-global behaviour.
   */
  value?: SelectedLocation | null | undefined;
  onChange?: ((location: SelectedLocation) => void) | undefined;
  disabled?: boolean | undefined;
}

/** Header control showing the selected location; opens the location dialog. */
export function LocationSelector({ value, onChange, disabled = false }: LocationSelectorProps = {}) {
  const { t } = useTranslation();
  const { location, detecting, openDialog, overrideSelect } = useLocationState();
  const controlled = onChange !== undefined;
  const shown = controlled ? (value ?? null) : location;
  const text =
    !controlled && detecting && !location ? t('location.locating') : (shown?.label ?? t('location.choose'));

  // Register/unregister this caller's sink so the single shared dialog resolves into the right place.
  // The identity of `onChange` must not be a dependency: callers pass an inline arrow, so a fresh function every render
  // would re-register state on the provider, re-render, and loop forever. A ref keeps the latest handler without that.
  const handlerRef = useRef(onChange);
  // Assigning during an effect (not render) keeps the latest handler without writing a ref while rendering.
  useEffect(() => {
    handlerRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (!onChange) return;
    const registered: (location: SelectedLocation) => void = (picked) => handlerRef.current?.(picked);
    overrideSelect(registered);
    return () => overrideSelect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- presence of onChange, not its identity, is what matters.
  }, [onChange !== undefined, overrideSelect]);

  return (
    <button
      type="button"
      className={styles.trigger}
      onClick={openDialog}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-label={shown ? t('location.change', { location: shown.label }) : t('location.choose')}
    >
      <Icon name={shown?.source === 'current' ? 'locate' : 'pin'} size={18} />
      <span className={styles.text}>{text}</span>
      <Icon name="chevronDown" size={16} />
    </button>
  );
}
