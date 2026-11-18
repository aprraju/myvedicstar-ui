import { describe, expect, it } from 'vitest';

import { divisionalState, kundaliCapabilitiesSchema, shadbalaState } from './kundali-capabilities';

/**
 * Deserialisation of a RAW JSON payload in the API's own casing.
 *
 * Every other test in this feature starts from a typed fixture object, which means **no test has ever exercised the
 * binding from wire to contract**. A `[JsonPropertyName]` added to the C# record, a serializer-default change, or a
 * casing regression would break the real response entirely while every existing test stayed green — because they all
 * skip the parse.
 *
 * This is the one test that would fail. It deliberately uses a literal string, not a fixture, so it cannot be
 * "fixed" by editing an object alongside the schema.
 *
 * The payload below is written exactly as `JsonSerializerDefaults.Web` emits it (camelCase), which is what
 * `AddControllers()` configures.
 */

/** Verbatim, as the API sends it. Do not reformat into a fixture. */
const RAW_API_JSON = `{
  "supportedDivisionalCharts": [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45],
  "provisionalDivisionalCharts": [60],
  "supportedShadbalaComponents": ["Sthana", "Dig", "Kala", "Naisargika", "Drik"],
  "unsupportedShadbalaComponents": ["Chesta"],
  "lunarNodeConvention": "MeanNode",
  "ascendantConvention": "GeocentricTrueSidereal",
  "minimumSupportedBirthDate": "1800-01-01",
  "maximumSupportedBirthDate": "2200-12-31",
  "unsupportedCapabilities": [
    "D60 and divisionals finer than D9 are returned provisional only, with a boundary distance; they are never asserted as definitive.",
    "Shadbala Chesta Bala is not computed; any Shadbala total is partial and is not a classical required-rupas verdict."
  ]
}`;

describe('capabilities — a raw API payload binds to the contract', () => {
  it('parses camelCase JSON from the wire', () => {
    const parsed = kundaliCapabilitiesSchema.safeParse(JSON.parse(RAW_API_JSON));
    expect(parsed.success).toBe(true);
  });

  it('preserves the three-way distinction after a real parse, not just from a fixture', () => {
    // The property, re-asserted through the parse path: D60 must still be provisional, an unlisted division absent.
    const parsed = kundaliCapabilitiesSchema.parse(JSON.parse(RAW_API_JSON));
    expect(divisionalState(parsed, 9).kind).toBe('supported');
    expect(divisionalState(parsed, 60).kind).toBe('provisional');
    expect(divisionalState(parsed, 5).kind).toBe('absent');
    expect(shadbalaState(parsed, 'Chesta').kind).toBe('absent');
    expect(shadbalaState(parsed, 'Sthana').kind).toBe('supported');
  });

  it('fails loudly on a snake_case payload, rather than silently producing empty lists', () => {
    // If the serialiser ever changes or a JsonPropertyName is added, this is the shape that would arrive. The schema
    // must reject it outright: an unparseable boundary is recoverable, a boundary that parses to "nothing supported"
    // is a lie the UI would render as fact.
    const snakeCase = RAW_API_JSON.replaceAll(
      'supportedDivisionalCharts',
      'supported_divisional_charts',
    ).replaceAll('unsupportedCapabilities', 'unsupported_capabilities');
    expect(kundaliCapabilitiesSchema.safeParse(JSON.parse(snakeCase)).success).toBe(false);
  });

  it('rejects a payload missing a required field rather than filling a default', () => {
    const partial = JSON.parse(RAW_API_JSON);
    delete partial.supportedDivisionalCharts;
    expect(kundaliCapabilitiesSchema.safeParse(partial).success).toBe(false);
  });
});
