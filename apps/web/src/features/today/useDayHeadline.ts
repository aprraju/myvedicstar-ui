import type { DaySummary } from '@myvedicstar/domain-models';

import { useTranslation } from '../../shared/i18n/I18nProvider';

/**
 * The day headline: from the backend's General day status when the response has it (the same status as calendar tiles
 * and Find a Good Time), otherwise the day-factor headline.
 */
export function useDayHeadline(summary: Pick<DaySummary, 'dayStatus' | 'tone' | 'headline'>): string {
  const { t } = useTranslation();
  return summary.dayStatus ? t(`summary.dayHeadline.${summary.tone}`) : summary.headline;
}
