import { describe, expect, it } from 'vitest';

import { divisionalState, kundaliCapabilitiesSchema, shadbalaState } from './kundali-capabilities';
import type { KundaliCapabilities } from './kundali-capabilities';

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

/**
 * Requiredness is asserted DIRECTLY, one field at a time (issue #135).
 *
 * The tests above all start from a payload that HAS every field, so a schema change that makes one `.optional()` cannot
 * fail them for the right reason: the partial-rename test would still go red, but because an array is *missing* rather
 * than because the field is *required* — and those are the same boolean. `unsupportedCapabilities` going optional would
 * parse a payload that stops sending it to an empty list, which is the "boundary that parses to nothing supported is a
 * lie the UI renders as fact" case this file's own comments name.
 *
 * So: delete one field at a time and require the issue path to NAME it. `success === false` alone is not the assertion,
 * because a `.optional()` field still parses and every other field's deletion would fail anyway.
 *
 * The list is explicit rather than derived from the schema's key order, so "this field is required" is a decision
 * recorded here. Every field of the contract is required (see the schema's own "none is optional" note); if one ever
 * legitimately becomes optional, it must be moved to `OPTIONAL_BY_DESIGN` with a reason instead of silently disappearing
 * from this list.
 */
const FIELDS_REQUIRED_BY_THE_CONTRACT = [
  'supportedDivisionalCharts',
  'provisionalDivisionalCharts',
  'supportedShadbalaComponents',
  'unsupportedShadbalaComponents',
  'lunarNodeConvention',
  'ascendantConvention',
  'minimumSupportedBirthDate',
  'maximumSupportedBirthDate',
  'unsupportedCapabilities',
] as const;

/** Fields a missing value may legitimately parse through, with the reason. Empty is the current, deliberate answer:
 *  a partial capability report invites the caller to fill the gaps with assumptions. */
const OPTIONAL_BY_DESIGN: ReadonlyArray<{ field: string; reason: string }> = [];

/**
 * Removes one field from the wire-derived fixture without a dynamic `delete`.
 *
 * `delete payload[field]` is flagged by `@typescript-eslint/no-dynamic-delete`, and rightly so in general: a computed
 * delete is unreviewable. Here the key is one the test just proved present, so the intent is safe — and destructuring
 * rest makes that intent visible to the linter instead of supposing it.
 */
function withoutField(payload: Record<string, unknown>, field: string): Record<string, unknown> {
  const { [field]: _removed, ...rest } = payload;
  return rest;
}

describe('capabilities — requiredness is asserted per field, not via a payload that satisfies it', () => {
  // Guards against the list drifting out of sync with the contract: a field added to the schema but not to the list
  // above would otherwise be silently unprotected, which is the exact defect this describe block exists to remove.
  it('lists every contract field exactly once, so no required field is left unasserted', () => {
    const contractFields = [...kundaliCapabilitiesSchema.keyof().options].sort();
    const listedFields = [
      ...FIELDS_REQUIRED_BY_THE_CONTRACT,
      ...OPTIONAL_BY_DESIGN.map(({ field }) => field),
    ].sort();
    expect(listedFields).toEqual(contractFields);
    expect(new Set(listedFields).size).toBe(listedFields.length);
  });

  it.each(FIELDS_REQUIRED_BY_THE_CONTRACT)(
    'rejects a payload without %s, and names that field in the issue path',
    (field) => {
      const payload = rawApiFixture() as Record<string, unknown>;
      expect(payload).toHaveProperty(field);

      const result = kundaliCapabilitiesSchema.safeParse(withoutField(payload, field));
      if (result.success) throw new Error(`dropping the required field ${field} must not parse`);
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain(field);
    },
  );

  it.each(OPTIONAL_BY_DESIGN)(
    'tolerates a payload without $field, which is optional by design',
    ({ field }) => {
      const payload = rawApiFixture() as Record<string, unknown>;
      expect(kundaliCapabilitiesSchema.safeParse(withoutField(payload, field)).success).toBe(true);
    },
  );

  it('has no field whose requiredness is a default nobody chose', () => {
    // Every key is in exactly one of the two lists; OPTIONAL_BY_DESIGN being empty means all nine are required.
    expect(OPTIONAL_BY_DESIGN).toHaveLength(0);
    expect(FIELDS_REQUIRED_BY_THE_CONTRACT).toHaveLength(kundaliCapabilitiesSchema.keyof().options.length);
  });
});

/**
 * The contract TYPE keeps every field required, not only the parser (issue #135).
 *
 * The tests above assert the zod schema's behaviour. `KundaliCapabilities = z.infer<...>`, so the exported type follows the
 * schema — but nothing in this file states that dependency. If a field became `.optional()`, the type every consumer
 * imports would admit `undefined`, and the payload tests would still be green because a payload that HAS the field
 * satisfies the weakened type. This maps each key to itself only when its type does NOT admit `undefined` and collects
 * the survivors: a key that is still required appears in the union, a silently optional one does not, and the
 * exhaustive comparison below fails with that key named.
 */
type RequiredKeysAreNotOptional = {
  [K in keyof KundaliCapabilities]-?: undefined extends KundaliCapabilities[K] ? never : K;
}[keyof KundaliCapabilities];

describe('capabilities — the exported contract TYPE keeps every field required', () => {
  it('accepts every contract key as a required key of the type, one explicitly-typed witness per field', () => {
    // A witness per contract field, each declared as the MUTUAL ASSIGNABILITY of that key against `RequiredKeysAreNotOptional`.
    // If a field becomes `.optional()` in the schema the key leaves the union, `Witnesses` no longer satisfies the mapped
    // type, and tsc fails ON THIS LINE naming the key - before any assertion runs. The array is never read at runtime;
    // it exists so the check is part of the suite's typecheck, not only of a value comparison that a widened type could
    // quietly satisfy.
    const witnesses = {
      supportedDivisionalCharts: true,
      provisionalDivisionalCharts: true,
      supportedShadbalaComponents: true,
      unsupportedShadbalaComponents: true,
      lunarNodeConvention: true,
      ascendantConvention: true,
      minimumSupportedBirthDate: true,
      maximumSupportedBirthDate: true,
      unsupportedCapabilities: true,
    } satisfies Record<RequiredKeysAreNotOptional, true>;

    // Runtime fence, second: every contract key must be one the type also calls required, and vice versa. Kept as a
    // comparison of two derived lists rather than a literal so nothing here restates the field set by hand.
    expect(Object.keys(witnesses).sort()).toEqual([...FIELDS_REQUIRED_BY_THE_CONTRACT].sort());
  });
});

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
