/**
 * Layout adapts to the *available window width*, never to device model names. Window classes follow Material 3
 * window size classes and apply equally to phones, tablets, foldables (folded and unfolded), split-screen,
 * desktop browsers and resized windows.
 *
 * | class      | width (px / dp) | typical                                           | layout                       |
 * |------------|-----------------|---------------------------------------------------|------------------------------|
 * | compact    | < 600           | phones, folded outer displays, narrow split view   | single column, bottom nav   |
 * | medium     | 600 – 839       | small tablets portrait, unfolded inner (portrait)  | single column, wider cards  |
 * | expanded   | 840 – 1199      | tablets landscape, unfolded inner (landscape)      | two panes (list | detail)   |
 * | large      | 1200 – 1599     | laptops, desktops                                  | two/three panes, top nav    |
 * | extraLarge | ≥ 1600          | wide desktops                                      | centred max-width content   |
 */
export type WindowClass = 'compact' | 'medium' | 'expanded' | 'large' | 'extraLarge';

export const windowClassBreakpoints = {
  medium: 600,
  expanded: 840,
  large: 1200,
  extraLarge: 1600,
} as const;

export function getWindowClass(width: number): WindowClass {
  if (width >= windowClassBreakpoints.extraLarge) return 'extraLarge';
  if (width >= windowClassBreakpoints.large) return 'large';
  if (width >= windowClassBreakpoints.expanded) return 'expanded';
  if (width >= windowClassBreakpoints.medium) return 'medium';
  return 'compact';
}

/** Whether there is room for two panes side by side (e.g. Calendar | Selected day). */
export function supportsTwoPanes(windowClass: WindowClass): boolean {
  return windowClass === 'expanded' || windowClass === 'large' || windowClass === 'extraLarge';
}
