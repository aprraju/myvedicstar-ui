import type { LocationSuggestion, ResolvedLocation } from '@myvedicstar/contracts';
import { coordinatesSchema } from '@myvedicstar/validation';

import { type SelectedLocation, toSelectedLocation } from './location';

export function suggestionLabel(place: LocationSuggestion): string {
  return [place.city, place.region, place.country, place.postalCode].filter(Boolean).join(', ');
}

export function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** GeoNames may name a nearby city; its coordinates must never replace the user's final coordinates. */
export function toPreciseSelectedLocation(
  resolved: ResolvedLocation,
  coordinates: { latitude: number; longitude: number },
  source: SelectedLocation['source'],
  suggestion?: LocationSuggestion,
): SelectedLocation {
  const exact = coordinatesSchema.parse(coordinates);
  if (!isIanaTimeZone(resolved.timeZone)) throw new Error('Location timezone unavailable');
  const label = suggestion ? suggestionLabel(suggestion) : undefined;
  return {
    ...toSelectedLocation({ ...resolved, ...exact }, source),
    ...exact,
    id: `${exact.latitude},${exact.longitude}`,
    label:
      label ??
      (resolved.place
        ? [resolved.place.city, resolved.place.state ?? resolved.place.country].filter(Boolean).join(', ')
        : `${exact.latitude}, ${exact.longitude}`),
    fullName: label ?? resolved.place?.displayName,
    geonameId: suggestion?.source === 'city' ? suggestion.id : undefined,
    postalCode: suggestion?.postalCode ?? undefined,
    city: suggestion?.city ?? resolved.place?.city,
    region: suggestion?.region ?? resolved.place?.state ?? undefined,
    country: suggestion?.country ?? resolved.place?.country,
  };
}

/** ISO 3166-1 regions supported by Intl.DisplayNames; no country is inferred from IP or postal-code syntax. */
const COUNTRY_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  );

export function countries(locale = 'en'): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  return COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}

export function countryCodeFor(input: string, locale = 'en'): string | undefined {
  const text = input.trim().normalize('NFC');
  if (!text) return undefined;
  if (COUNTRY_CODES.includes(text.toUpperCase())) return text.toUpperCase();
  return [...countries(locale), ...countries('en')].find(
    (country) => country.name.toLocaleLowerCase(locale) === text.toLocaleLowerCase(locale),
  )?.code;
}
