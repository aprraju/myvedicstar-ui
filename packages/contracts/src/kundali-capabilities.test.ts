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
 * This is the one test that would fail. The fixture below is DERIVED by parsing this literal, so `RAW_API_JSON` is the
 * only source of truth: there is no second object to edit alongside the schema, and `JSON.stringify(fixture)` cannot
 * quietly become the test input because the fixture comes *from* the string. A comment alone could not enforce that.
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

/**
 * The fixture every other assertion starts from, derived from the wire literal rather than declared beside it.
 *
 * If this module's export is used as a fixture elsewhere, the string above remains the single source: changing the
 * schema without changing the wire text fails the parse test, and changing the wire text changes every derived value.
 */
export const rawApiFixture = (): unknown => JSON.parse(RAW_API_JSON);

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

  it('names the renamed field in the issue path, so a partial rename is not mistaken for a missing array', () => {
    // A PARTIAL rename - one field only - is the shape a single [JsonPropertyName] on a C# property produces. The
    // previous version renamed two keys and asserted success === false, which cannot tell "rejected because of the
    // rename" from "rejected because an array went missing": both produce a failure, and one of them is a bug in the
    // test rather than a finding about the schema.
    const payload = rawApiFixture() as Record<string, unknown>;
    payload.supported_divisional_charts = payload.supportedDivisionalCharts;
    delete payload.supportedDivisionalCharts;

    const result = kundaliCapabilitiesSchema.safeParse(payload);
    if (result.success) throw new Error('a partial rename must not parse');
    expect(result.success).toBe(false);

    // Zod reports a missing REQUIRED field on the field's own path; the stray key is discarded by the non-strict parse
    // and never becomes an issue. So the issue path names the contract field that the rename orphaned, which is what
    // distinguishes "rejected because this property arrived under another name" from "rejected because the array went
    // missing": both fail, but only the rename leaves the original key absent while a renamed twin is present.
    const paths = result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toContain('supportedDivisionalCharts');

    // The rename is provably present in the input, so the failure above is attributable to it and not to a fixture that
    // accidentally dropped the array. Without this, the test would still pass if the payload were simply truncated.
    expect(payload).toHaveProperty('supported_divisional_charts');
    expect(payload).not.toHaveProperty('supportedDivisionalCharts');
  });

  it('still rejects a fully snake_case payload rather than silently producing empty lists', () => {
    // If the serialiser ever changes wholesale, this is the shape that would arrive. The schema must reject it outright:
    // an unparseable boundary is recoverable, a boundary that parses to "nothing supported" is a lie the UI renders.
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
