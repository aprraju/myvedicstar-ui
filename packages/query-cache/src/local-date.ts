import { msUntilNextLocalDay, todayIn } from '@myvedicstar/date-time';
import { isIanaTimeZone } from '@myvedicstar/domain-models';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

/** Midnight timer plus resume/reconnect checks. No browser or native dependencies. */
export function subscribeLocalDate(timeZone: string | undefined, notify: () => void): () => void {
  if (!timeZone || !isIanaTimeZone(timeZone)) return () => undefined;
  let timer: ReturnType<typeof setTimeout>;
  const check = () => {
    clearTimeout(timer);
    notify();
    timer = setTimeout(check, msUntilNextLocalDay(timeZone) + 1);
  };
  timer = setTimeout(check, msUntilNextLocalDay(timeZone) + 1);
  const unfocus = focusManager.subscribe((focused) => {
    if (focused) check();
  });
  const unonline = onlineManager.subscribe((online) => {
    if (online) check();
  });
  return () => {
    clearTimeout(timer);
    unfocus();
    unonline();
  };
}

export function useLocalDate(timeZone: string | undefined): string | undefined {
  const subscribe = useCallback((notify: () => void) => subscribeLocalDate(timeZone, notify), [timeZone]);
  const snapshot = useCallback(
    () => (timeZone && isIanaTimeZone(timeZone) ? todayIn(timeZone) : undefined),
    [timeZone],
  );
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
