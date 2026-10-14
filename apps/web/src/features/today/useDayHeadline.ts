import type { DaySummary } from '@myvedicstar/domain-models';

/**
 * The overall day label comes from Panchang guidance, matching calendar tiles and rating explanations.
 */
export function useDayHeadline(summary: Pick<DaySummary, 'dayStatus' | 'tone' | 'headline'>): string {
  return summary.headline;
}
