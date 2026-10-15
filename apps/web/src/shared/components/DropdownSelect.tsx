import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

import { Icon } from './Icon';
import type { SheetOption } from './SheetSelect';
import styles from './SheetSelect.module.css';

/**
 * A compact dropdown for phones: the field-like button opens a small list directly below it (about five rows, then it
 * scrolls inside itself, never the page). 44px rows; the chosen one has a check mark. WAI-ARIA listbox pattern: arrow
 * keys / Home / End move, Enter or Space chooses, Escape or a tap outside closes and returns focus to the button.
 */
export function DropdownSelect<T extends string>({
  value,
  options,
  onChange,
  labelledBy,
  disabled,
}: Readonly<{
  value: T;
  options: readonly SheetOption<T>[];
  onChange: (value: T) => void;
  /** Id of the visible label (the value is announced after it). */
  labelledBy: string;
  disabled?: boolean;
}>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const listId = useId();
  const valueId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const current = optionRefs.current[selectedIndex];
    current?.focus({ preventScroll: true });
    // Show the chosen row inside the list, and the whole list on screen.
    current?.scrollIntoView?.({ block: 'nearest' });
    listRef.current?.scrollIntoView?.({ block: 'nearest' });
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
    // The selected row is read once when the list opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const choose = (next: T) => {
    close();
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
      Escape: close,
      Tab: () => setOpen(false),
    };
    const action = keys[event.key];
    if (action) {
      if (event.key !== 'Tab') event.preventDefault();
      action();
    }
  };

  return (
    <div ref={rootRef} className={styles.dropdown}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelledBy} ${valueId}`}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span id={valueId} className={styles.value}>
          {selected?.label}
        </span>
        <Icon name="chevronDown" size={20} />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          className={styles.dropdownList}
        >
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
              className={styles.dropdownOption}
              onClick={() => choose(option.value)}
              onKeyDown={(event) => onKeyDown(event, index, option)}
            >
              <span>{option.label}</span>
              {option.value === value && <Icon name="check" size={18} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
