import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

import { useTranslation } from '../i18n/I18nProvider';
import { Icon } from './Icon';
import styles from './SheetSelect.module.css';

export interface SheetOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A phone-standard picker: a field-like button that opens a modal bottom sheet (Material 3 bottom sheet / iOS sheet)
 * with a drag handle, a title and a scrollable list of 56px rows; the chosen row has a check mark. Built on the native
 * <dialog> (top layer, inert background, Escape to close, focus containment), like the shared Dialog. While open the
 * page behind does not scroll (CSSOM only, no injected <style>, so the strict CSP holds); focus returns to the button.
 * The list follows the WAI-ARIA listbox pattern: arrow keys / Home / End move, Enter or Space chooses.
 */
export function SheetSelect<T extends string>({
  title,
  value,
  options,
  onChange,
  labelledBy,
  label,
  disabled,
  size = 'field',
}: Readonly<{
  /** Sheet heading. */
  title: string;
  value: T;
  options: readonly SheetOption<T>[];
  onChange: (value: T) => void;
  /** Id of a visible label for the button (its value is announced after it). */
  labelledBy?: string;
  /** Accessible label when there is no visible one. */
  label?: string;
  disabled?: boolean;
  /** `field` for form fields, `compact` for a small pill in a card header. */
  size?: 'field' | 'compact';
}>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const titleId = useId();
  const valueId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    const dialog = dialogRef.current;
    const button = buttonRef.current;
    if (!dialog || !open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    // Keep the page behind still while the sheet scrolls.
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    const current = optionRefs.current[selectedIndex];
    current?.focus();
    current?.scrollIntoView?.({ block: 'center' });
    return () => {
      root.style.overflow = previous;
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      button?.focus();
    };
    // Opening is the only trigger; the selected row is read once when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (next: T) => {
    setOpen(false);
    if (next !== value) onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>, index: number, option: SheetOption<T>) => {
    const focus = (to: number) => optionRefs.current[(to + options.length) % options.length]?.focus();
    const keys: Record<string, () => void> = {
      ArrowDown: () => focus(index + 1),
      ArrowUp: () => focus(index - 1),
      Home: () => focus(0),
      End: () => focus(options.length - 1),
      Enter: () => choose(option.value),
      ' ': () => choose(option.value),
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        data-size={size}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={labelledBy ? undefined : `${label ?? title}: ${selected?.label ?? ''}`}
        aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span id={valueId} className={styles.value}>
          {selected?.label}
        </span>
        <Icon name="chevronDown" size={size === 'compact' ? 16 : 20} />
      </button>
      {/* A tap on the scrim (the <dialog> itself) closes; keyboard users close with Escape or the Close button. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialogRef}
        className={styles.sheet}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        {open && (
          <div className={styles.panel}>
            <span className={styles.handle} aria-hidden="true" />
            <div className={styles.header}>
              <h2 id={titleId}>{title}</h2>
              <button
                type="button"
                className={styles.close}
                aria-label={t('a11y.close')}
                onClick={() => setOpen(false)}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <ul role="listbox" aria-labelledby={titleId} className={styles.list}>
              {options.map((option, index) => (
                // Listbox options are focusable list items (WAI-ARIA listbox pattern).
                <li
                  key={option.value}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  role="option"
                  aria-selected={option.value === value}
                  tabIndex={option.value === value ? 0 : -1}
                  className={styles.option}
                  onClick={() => choose(option.value)}
                  onKeyDown={(event) => onKeyDown(event, index, option)}
                >
                  <span>{option.label}</span>
                  {option.value === value && <Icon name="check" size={20} />}
                </li>
              ))}
            </ul>
          </div>
        )}
      </dialog>
    </>
  );
}
