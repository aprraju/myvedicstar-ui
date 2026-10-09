import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useWindowClass } from './useWindowClass';

function resizeTo(width: number) {
  act(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    window.dispatchEvent(new Event('resize'));
  });
}

describe('useWindowClass', () => {
  it('follows runtime window size changes, e.g. a foldable unfolding', () => {
    resizeTo(344); // folded outer display
    const { result } = renderHook(() => useWindowClass());
    expect(result.current).toBe('compact');

    resizeTo(884); // unfolded inner display, landscape
    expect(result.current).toBe('expanded');

    resizeTo(1920);
    expect(result.current).toBe('extraLarge');
  });
});
