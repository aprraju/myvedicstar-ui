import { ApiError, createApiClient } from '@myvedicstar/api-client';
import type { LocationSuggestion } from '@myvedicstar/contracts';
import { countries, countryCodeFor, suggestionLabel } from '@myvedicstar/domain-models';
import { parseLocationInput } from '@myvedicstar/validation';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCachingClient } from './client';
import { createLocationSearchService, locationSearchOptions } from './location-search';

const settings = {
  enabled: true,
  debounceMs: 350,
  maxResults: 8,
  recentLimit: 5,
  searchStaleTimeMs: 86400_000,
  resolveStaleTimeMs: 7 * 86400_000,
};
const india: LocationSuggestion = {
  id: '1269843',
  city: 'Hyderabad',
  region: 'Telangana',
  country: 'India',
  countryCode: 'IN',
  postalCode: null,
  latitude: 17.385,
  longitude: 78.4867,
  source: 'city',
};
const pakistan: LocationSuggestion = {
  ...india,
  id: '1176734',
  region: 'Sindh',
  country: 'Pakistan',
  countryCode: 'PK',
  latitude: 25.396,
  longitude: 68.3578,
};
const clients: ReturnType<typeof createCachingClient>[] = [];
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

function setup(
  responder: (url: URL) => { status?: number; body: unknown } = (url) => ({
    body: url.pathname.endsWith('/timezone')
      ? { timeZone: 'Asia/Kolkata' }
      : url.pathname.endsWith('/reverse')
        ? { place: india }
        : { results: [india, pakistan, india] },
  }),
) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const result = responder(new URL(String(input)));
    return new Response(JSON.stringify(result.body), {
      status: result.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const api = createApiClient({
    baseUrl: 'https://api.test.example/api/v1',
    fetchImpl: fetch,
    coordinateDecimals: false,
  });
  const client = createCachingClient();
  clients.push(client);
  return { api, client, fetch, service: createLocationSearchService(api, client, settings) };
}

describe('worldwide location search', () => {
  it('keeps distinct cities in different countries, removes duplicate IDs and defers timezone resolution', async () => {
    const { service, fetch } = setup();
    const results = await service.autocomplete('Hyderabad', undefined, 'en', new AbortController().signal);
    expect(results.map((place) => suggestionLabel(place))).toEqual([
      'Hyderabad, Telangana, India',
      'Hyderabad, Sindh, Pakistan',
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/locations/search?');
  });

  it.each(['78626', '10001', '110001', 'SW1A 1AA', 'M5V 3L9', '100-0001', '10115'])(
    'routes %s to international postal lookup without assuming a country',
    async (text) => {
      const { service, fetch } = setup();
      await service.autocomplete(text, undefined, 'en', new AbortController().signal);
      const url = new URL(String(fetch.mock.calls[0]?.[0]));
      expect(url.pathname).toBe('/api/v1/locations/postal');
      expect(url.searchParams.get('country')).toBeNull();
    },
  );

  it('normalizes Unicode inputs and includes country, language and result count in cache identity', async () => {
    const { service, client, fetch } = setup();
    const first = locationSearchOptions(service, settings, ' München ', 'DE', 'de');
    await client.fetchQuery(first);
    await client.fetchQuery(locationSearchOptions(service, settings, 'München', 'DE', 'de'));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(locationSearchOptions(service, settings, 'München', 'AT', 'de').queryKey).not.toEqual(
      first.queryKey,
    );
    expect(locationSearchOptions(service, settings, 'München', 'DE', 'en').queryKey).not.toEqual(
      first.queryKey,
    );
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get('text')).toBe('München');
    expect(url.searchParams.get('country')).toBe('DE');
  });

  it('preserves exact input coordinates while using the nearby place solely as a label', async () => {
    const { service, fetch } = setup();
    const selected = await service.resolveCoordinates(-33.8688, 151.2093, 'coordinates');
    expect(selected.latitude).toBe(-33.8688);
    expect(selected.longitude).toBe(151.2093);
    expect(selected.timeZone).toBe('Asia/Kolkata');
    await service.resolveCoordinates(-33.8688, 151.2093, 'coordinates');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('sends exact coordinates for calculations when the GeoNames workflow is enabled', async () => {
    const { api, fetch } = setup(() => ({ status: 503, body: {} }));
    await api.panchang
      .today({ location: { latitude: 30.2672, longitude: -97.7431, timeZone: 'America/Chicago' } })
      .catch(() => undefined);
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get('latitude')).toBe('30.2672');
    expect(url.searchParams.get('longitude')).toBe('-97.7431');
  });

  it('allows a coordinate label when reverse lookup fails but requires a valid timezone', async () => {
    const { service } = setup((url) =>
      url.pathname.endsWith('/timezone')
        ? { body: { timeZone: 'America/Chicago' } }
        : { status: 503, body: {} },
    );
    const selected = await service.resolveCoordinates(30.2672, -97.7431, 'coordinates');
    expect(selected.label).toBe('30.2672, -97.7431');
    const invalid = setup(() => ({ body: { timeZone: 'Not/AZone' } }));
    await expect(invalid.service.resolveCoordinates(30.2672, -97.7431, 'coordinates')).rejects.toMatchObject({
      kind: 'validation',
    });
  });

  it('rejects invalid coordinates before calling the API', async () => {
    const { service, fetch } = setup();
    await expect(service.resolveCoordinates(95, 0, 'coordinates')).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(parseLocationInput('30.2672, -97.7431')).toMatchObject({
      ok: true,
      value: { kind: 'coordinates', latitude: 30.2672, longitude: -97.7431 },
    });
  });

  it('requires an explicit selection for ambiguous search results', async () => {
    const { service, fetch } = setup();
    await service.autocomplete('Hyderabad', undefined, 'en', new AbortController().signal);
    expect(fetch).toHaveBeenCalledTimes(1);
    const selected = await service.select(india);
    expect(selected.geonameId).toBe(india.id);
    expect(selected.selectionKind).toBe('city');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retains postal selection metadata without changing the existing source contract', async () => {
    const { service } = setup();
    const selected = await service.select({ ...india, source: 'postal', postalCode: '110001' });
    expect(selected).toMatchObject({ source: 'search', selectionKind: 'postal', postalCode: '110001' });
  });

  it('never caches provider errors as successful results', async () => {
    const { service, client, fetch } = setup(() => ({ status: 429, body: {} }));
    const options = locationSearchOptions(service, settings, 'Austin', undefined, 'en');
    await expect(client.fetchQuery(options)).rejects.toBeInstanceOf(ApiError);
    expect(client.getQueryState(options.queryKey)?.status).toBe('error');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('resolves country names and ISO codes without inferring a country from postal input', () => {
    expect(countryCodeFor('India')).toBe('IN');
    expect(countryCodeFor('us')).toBe('US');
    expect(countryCodeFor('Germany')).toBe('DE');
    expect(countryCodeFor('unknown')).toBeUndefined();
    expect(countries()).toHaveLength(249);
  });
});
