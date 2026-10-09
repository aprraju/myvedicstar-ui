import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { ThemeProvider, useAppearance } from './ThemeProvider';

const wrapper = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

describe('ThemeProvider', () => {
  it('follows the system theme by default (no data-theme attribute)', () => {
    const { result } = renderHook(() => useAppearance(), { wrapper });
    expect(result.current.appearance).toBe('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('applies and remembers an explicit choice', () => {
    const { result } = renderHook(() => useAppearance(), { wrapper });
    act(() => result.current.setAppearance('dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('mvs.appearance')).toBe('"dark"');
  });

  it('ignores tampered stored values', () => {
    window.localStorage.setItem('mvs.appearance', '"<script>"');
    const { result } = renderHook(() => useAppearance(), { wrapper });
    expect(result.current.appearance).toBe('system');
  });
});
