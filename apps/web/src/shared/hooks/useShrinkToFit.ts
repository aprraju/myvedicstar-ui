import { type RefObject, useLayoutEffect } from 'react';

/**
 * Scales an element's font down just enough for its text to fit its width (never below `minScale` of the styled size),
 * re-measured when the space changes. The app uses system fonts, and some (e.g. DejaVu Sans on Linux) are much wider
 * than Roboto or San Francisco, so a word that fits on most phones can overflow its card on others.
 */
export function useShrinkToFit(ref: RefObject<HTMLElement | null>, text: string, minScale = 0.8): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => {
      element.style.fontSize = '';
      const overflow = element.scrollWidth - element.clientWidth;
      if (overflow <= 0 || element.clientWidth === 0) return;
      const size = parseFloat(getComputedStyle(element).fontSize);
      const scale = Math.max(minScale, element.clientWidth / element.scrollWidth);
      // Round down to a tenth of a pixel so rounding never leaves a sliver of overflow.
      element.style.fontSize = `${Math.floor(size * scale * 10) / 10}px`;
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit);
    observer?.observe(element.parentElement ?? element);
    return () => observer?.disconnect();
  }, [ref, text, minScale]);
}
