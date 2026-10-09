import type { StatusTone } from '@myvedicstar/domain-models';

import type { IconName } from './components';
import type { Theme } from './theme';

/**
 * App-wide status colors (same as web): Highly Favorable → strong green, Favorable → green, Mixed and Caution → orange,
 * Avoid → red. Always shown with an icon and text, never color alone.
 */
export function statusToneColors(theme: Theme, tone: StatusTone): { fg: string; bg: string } {
  switch (tone) {
    case 'highly-favorable':
      return { fg: theme.colors.favorableStrong, bg: theme.colors.favorableStrongSurface };
    case 'favorable':
      return { fg: theme.colors.favorable, bg: theme.colors.favorableSurface };
    case 'avoid':
      return { fg: theme.colors.caution, bg: theme.colors.cautionSurface };
    default:
      return { fg: theme.colors.warning, bg: theme.colors.warningSurface };
  }
}

export const STATUS_ICON: Record<StatusTone, IconName> = {
  'highly-favorable': 'checkmark-circle',
  favorable: 'checkmark-circle',
  mixed: 'information-circle',
  caution: 'warning',
  avoid: 'warning',
};
