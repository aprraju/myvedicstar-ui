import type { MessageKey } from '@myvedicstar/localization';
import { useMatches } from 'react-router';

import { useTranslation } from '../i18n/I18nProvider';

/** Route `handle` metadata used for the document title, announcements and screen analytics. */
export interface RouteHandle {
  titleKey: MessageKey;
  /** Stable, language-independent screen name for analytics, e.g. `Home`. */
  screen: string;
}

function isRouteHandle(value: unknown): value is RouteHandle {
  return typeof value === 'object' && value !== null && 'titleKey' in value && 'screen' in value;
}

/** Title and screen name of the deepest matched route that declares them. */
export function useRouteHandle(): { title: string; screen: string } {
  const { t } = useTranslation();
  const matches = useMatches();
  const handle = [...matches]
    .reverse()
    .map((m) => m.handle)
    .find(isRouteHandle);
  return { title: handle ? t(handle.titleKey) : t('app.name'), screen: handle?.screen ?? 'Unknown' };
}
