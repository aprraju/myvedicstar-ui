import {
  colors,
  type ColorScheme,
  fontSize,
  fontWeight,
  getWindowClass,
  lineHeight,
  radius,
  spacing,
  touchTarget,
  type WindowClass,
} from '@myvedicstar/design-tokens';
import { useColorScheme, useWindowDimensions } from 'react-native';

export interface Theme {
  dark: boolean;
  colors: ColorScheme;
  spacing: typeof spacing;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  lineHeight: typeof lineHeight;
  radius: typeof radius;
  touchTarget: typeof touchTarget;
}

/** The same semantic tokens as web, as React Native values. Follows the system appearance. */
export function useTheme(): Theme {
  const dark = useColorScheme() === 'dark';
  return {
    dark,
    colors: dark ? colors.dark : colors.light,
    spacing,
    fontSize,
    fontWeight,
    lineHeight,
    radius,
    touchTarget,
  };
}

/**
 * Window size class from the *current window* (updates on rotation, foldable unfold, split-screen and
 * freeform resizing). Never branch on device model.
 */
export function useWindowClass(): WindowClass {
  const { width } = useWindowDimensions();
  return getWindowClass(width);
}

/** React Native font weights are strings. */
export const weight = (value: number) => String(value) as '400' | '500' | '600' | '700';
