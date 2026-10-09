import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { generateTokensCss } from './css';
import { colors, type ColorScheme, getWindowClass, supportsTwoPanes } from './index';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

type Key = keyof ColorScheme;
const TEXT_ON: [Key, Key[]][] = [
  ['textPrimary', ['background', 'surface', 'surfaceElevated', 'surfaceSubtle']],
  ['textSecondary', ['background', 'surface', 'surfaceElevated', 'surfaceSubtle']],
  ['primary', ['background', 'surface']],
  ['secondary', ['background', 'surface']],
  ['onPrimary', ['primary']],
  ['onSecondary', ['secondary']],
  ['favorable', ['favorableSurface', 'surface', 'background']],
  ['favorableStrong', ['favorableStrongSurface', 'surface', 'background']],
  ['caution', ['cautionSurface', 'surface', 'background']],
  ['auspicious', ['auspiciousSurface', 'surface', 'background']],
  ['warning', ['warningSurface', 'surface', 'background']],
  ['info', ['infoSurface', 'surface', 'background']],
  ['error', ['errorSurface', 'surface', 'background']],
];

describe.each(['light', 'dark'] as const)('%s color scheme', (mode) => {
  const scheme = colors[mode];

  it.each(TEXT_ON)('%s text meets WCAG AA (4.5:1) on its backgrounds', (text, backgrounds) => {
    for (const bg of backgrounds) {
      expect(contrast(scheme[text], scheme[bg]), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('focus indicator and strong borders meet non-text contrast (3:1)', () => {
    for (const bg of ['background', 'surface'] as const) {
      expect(contrast(scheme.focus, scheme[bg])).toBeGreaterThanOrEqual(3);
      expect(contrast(scheme.borderStrong, scheme[bg])).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('window classes', () => {
  it.each([
    [320, 'compact'],
    [390, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [768, 'medium'],
    [820, 'medium'],
    [1024, 'expanded'],
    [1280, 'large'],
    [1440, 'large'],
    [1920, 'extraLarge'],
  ] as const)('%ipx is %s', (width, expected) => {
    expect(getWindowClass(width)).toBe(expected);
  });

  it('offers two panes from expanded width (e.g. unfolded foldable in landscape)', () => {
    expect(supportsTwoPanes(getWindowClass(884))).toBe(true);
    expect(supportsTwoPanes(getWindowClass(344))).toBe(false);
  });
});

describe('generated CSS', () => {
  it('is up to date with the tokens (run `npm run tokens:css`)', () => {
    const committed = readFileSync(fileURLToPath(new URL('../css/tokens.css', import.meta.url)), 'utf8');
    expect(committed).toBe(generateTokensCss());
  });
});
