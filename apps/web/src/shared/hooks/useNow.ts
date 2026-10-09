import { useEffect, useState } from 'react';

/**
 * The current instant, refreshed on the minute boundary (and when the tab becomes visible again), so "Good time now"
 * and "Next caution period" stay correct while the page stays open.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setNow(Date.now());
          schedule();
        },
        60_000 - (Date.now() % 60_000) + 50,
      );
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return now;
}
