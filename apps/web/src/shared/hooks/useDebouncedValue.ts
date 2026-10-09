import { useEffect, useState } from 'react';

/**
 * `value`, updated only after it has stopped changing for `delayMs`. Used so rapid repeated selections (tapping
 * through activity cards) send one request for the final choice instead of one per tap.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
