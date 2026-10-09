/**
 * Semantic design tokens shared by web (as CSS custom properties, see `css/tokens.css`) and React Native (as values).
 *
 * Direction: the "myvedicstar-default" theme (design reference kit: docs/design/myvedicstar-default-theme) — warm ivory foundation, deep
 * navy text, bronze/gold actions, green favorable, coral/red caution and blue informational states. Status is never conveyed by color alone; components pair these colors with an icon and a text label.
 * Every text/background pair is checked for WCAG 2.2 AA contrast in `tokens.test.ts`.
 */

export interface ColorScheme {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  borderStrong: string;
  focus: string;
  favorable: string;
  favorableSurface: string;
  /**
   * Highly Favorable status (dark, strong green). Status tones app-wide: Highly Favorable → favorableStrong,
   * Favorable → favorable, Mixed and Caution → warning (orange), Avoid → caution (red).
   */
  favorableStrong: string;
  favorableStrongSurface: string;
  caution: string;
  cautionSurface: string;
  auspicious: string;
  auspiciousSurface: string;
  /** Resolved conflicts, e.g. a favorable period that overlaps an unfavorable one (orange, with a warning icon). */
  warning: string;
  warningSurface: string;
  info: string;
  infoSurface: string;
  error: string;
  errorSurface: string;
}

export const colors: { light: ColorScheme; dark: ColorScheme } = {
  light: {
    background: '#FBFAF7',
    surface: '#FFFEFA',
    surfaceElevated: '#FFFFFF',
    surfaceSubtle: '#F7F5F0',
    primary: '#9B5A17',
    onPrimary: '#FFFFFF',
    secondary: '#00736F',
    onSecondary: '#FFFFFF',
    textPrimary: '#0D1B2E',
    textSecondary: '#5A6679',
    border: '#E7E2D9',
    borderStrong: '#857D72',
    focus: '#0866A6',
    favorable: '#087A3B',
    favorableSurface: '#EDF8EE',
    favorableStrong: '#035A2B',
    favorableStrongSurface: '#DDF2E3',
    caution: '#C92F32',
    cautionSurface: '#FFF0EF',
    auspicious: '#7B4310',
    auspiciousSurface: '#FFF4E6',
    warning: '#9A4D00',
    warningSurface: '#FFF1E0',
    info: '#0866A6',
    infoSurface: '#EDF6FF',
    error: '#B3261E',
    errorSurface: '#FCEBEA',
  },
  dark: {
    background: '#11151C',
    surface: '#1A1F28',
    surfaceElevated: '#222834',
    surfaceSubtle: '#161B23',
    primary: '#E6B062',
    onPrimary: '#1F1406',
    secondary: '#7CC4BC',
    onSecondary: '#0C1C1A',
    textPrimary: '#ECEFF4',
    textSecondary: '#A9B3C1',
    border: '#323A47',
    borderStrong: '#6F7A8A',
    focus: '#8DB8E6',
    favorable: '#86CC9C',
    favorableSurface: '#1B2B21',
    favorableStrong: '#B4EBC3',
    favorableStrongSurface: '#123320',
    caution: '#F0A08A',
    cautionSurface: '#33211C',
    auspicious: '#E2BD6E',
    auspiciousSurface: '#2E2716',
    warning: '#F2A65A',
    warningSurface: '#33240F',
    info: '#8DB8E6',
    infoSurface: '#1A2635',
    error: '#F2B8B5',
    errorSurface: '#3A1D1C',
  },
};

/** 4-point spacing scale, in px (web converts to rem so it scales with the user's font size). */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export const fontFamily = {
  /** System fonts first: no web-font download and no extra CSP origin. Noto families cover Indic scripts. */
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Telugu", "Noto Sans Tamil", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Devanagari", "Noto Sans Gujarati", "Noto Sans Bengali", "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Noto Serif", "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;

/** Font sizes in px (web converts to rem). */
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 36,
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/** Unitless line heights; Indic scripts need generous leading. */
export const lineHeight = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Elevation: restrained shadows (web) and matching Android elevation levels. */
export const elevation = {
  none: { css: 'none', android: 0 },
  low: { css: '0 2px 8px rgb(28 31 35 / 0.06)', android: 1 },
  medium: { css: '0 10px 28px rgb(45 38 28 / 0.10)', android: 3 },
  high: { css: '0 18px 50px rgb(45 38 28 / 0.15)', android: 8 },
} as const;

export const iconSize = { sm: 16, md: 20, lg: 24, xl: 32 } as const;

/** Minimum interactive target (WCAG 2.5.8 needs 24; platform guidance is 44 pt iOS / 48 dp Android). */
export const touchTarget = { minimum: 44, comfortable: 48 } as const;

export const motion = {
  durationFast: 120,
  durationMedium: 200,
  durationSlow: 320,
  easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export const layout = {
  /** Maximum width of readable page content. */
  contentMaxWidth: 1200,
  /** Maximum width of text blocks, in characters. */
  readableMaxCh: 70,
  gutter: { compact: 16, medium: 24, expanded: 32 },
} as const;
