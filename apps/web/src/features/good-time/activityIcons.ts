import type { StatusTone } from '@myvedicstar/domain-models';

import type { IconName } from '../../shared/components/Icon';

/**
 * Backend activity icon keys (`/muhurta/activities`) → icons. Unknown keys from a newer backend fall back to a
 * generic icon, so new activities appear without a UI release.
 */
const ACTIVITY_ICONS: Record<string, IconName> = {
  briefcase: 'briefcase',
  plane: 'plane',
  'home-key': 'home',
  car: 'car',
  'document-signature': 'document',
  book: 'book',
  lamp: 'lamp',
  rings: 'rings',
  house: 'home',
  sun: 'sun',
  more: 'more',
};

export function activityIcon(key: string): IconName {
  return ACTIVITY_ICONS[key] ?? 'sparkle';
}

/** Status icon by tone: a check only for the two favorable tones, a warning otherwise (never color alone). */
export const STATUS_ICON: Record<StatusTone, IconName> = {
  'highly-favorable': 'check',
  favorable: 'check',
  mixed: 'alert',
  caution: 'alert',
  avoid: 'alert',
};
