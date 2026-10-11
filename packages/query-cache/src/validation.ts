import type { PanchangParams } from '@myvedicstar/api-client';
import { isIanaTimeZone } from '@myvedicstar/domain-models';
import { coordinatesSchema } from '@myvedicstar/validation';

export function validLocalDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const instant = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(instant.getTime()) && instant.toISOString().slice(0, 10) === date;
}

export function validCalculationParams(params: PanchangParams | null): boolean {
  return (
    params !== null &&
    coordinatesSchema.safeParse(params.location).success &&
    Boolean(params.location.timeZone && isIanaTimeZone(params.location.timeZone))
  );
}
