import { getWindowClass, type WindowClass } from '@myvedicstar/design-tokens';
import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void) {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

/**
 * The current window size class, from the *available window width* (not device type). Re-renders only when the
 * class changes — e.g. when a foldable unfolds, a window is resized, or split-screen changes.
 * Prefer CSS media/container queries for pure styling; use this when the component tree itself changes
 * (e.g. one pane vs. two panes).
 */
export function useWindowClass(): WindowClass {
  return useSyncExternalStore(
    subscribe,
    () => getWindowClass(window.innerWidth),
    () => 'compact',
  );
}
