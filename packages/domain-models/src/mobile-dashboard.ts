import type { GuidanceFactor } from '@myvedicstar/contracts';

import type { PeriodItem } from './day-dashboard';

/** Presentation order only: retain every backend interval and resolved overlap unchanged. */
export function mobilePeriodOrder(items: readonly PeriodItem[]): PeriodItem[] {
  const rank = { now: 0, upcoming: 1, past: 2 } as const;
  return [...items].sort((a, b) => rank[a.state] - rank[b.state]);
}

/** Userinfo names may use a comma between given and family names. */
export function dashboardFirstName(name: string | undefined): string | undefined {
  return name?.trim().split(/[\s,]+/u)[0] || undefined;
}

/** Remove the repeated heading from an existing backend explanation, retaining its wording. */
export function dashboardFactorReason(factor: GuidanceFactor): string {
  const prefix = `${factor.limbName} ${factor.name}: ${factor.ratingName}.`;
  const reason = factor.reason.trim();
  return reason.startsWith(prefix) ? reason.slice(prefix.length).trim() || reason : reason;
}
