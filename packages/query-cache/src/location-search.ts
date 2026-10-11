import { type ApiClient, ApiError } from '@myvedicstar/api-client';
import type { LocationSuggestion } from '@myvedicstar/contracts';
import { isIanaTimeZone, toPreciseSelectedLocation } from '@myvedicstar/domain-models';
import { coordinatesSchema, parseLocationInput } from '@myvedicstar/validation';
import { type QueryClient, queryOptions, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

export interface LocationSearchSettings {
  enabled: boolean;
  debounceMs: number;
  maxResults: number;
  recentLimit: number;
  searchStaleTimeMs: number;
  resolveStaleTimeMs: number;
}

export interface LocationSearchService {
  autocomplete(
    text: string,
    country: string | undefined,
    language: string,
    signal: AbortSignal,
  ): Promise<LocationSuggestion[]>;
  resolveCoordinates(
    latitude: number,
    longitude: number,
    source: 'current' | 'coordinates',
    signal?: AbortSignal,
  ): ReturnType<typeof resolveLocation>;
  select(suggestion: LocationSuggestion, signal?: AbortSignal): ReturnType<typeof resolveLocation>;
}

export function locationSearchOptions(
  service: LocationSearchService,
  settings: LocationSearchSettings,
  text: string,
  country: string | undefined,
  language: string,
) {
  const normalized = text.trim().normalize('NFC');
  const parsed = parseLocationInput(normalized);
  return queryOptions({
    queryKey: [
      'locations',
      'autocomplete',
      normalized.toLowerCase(),
      country ?? null,
      language,
      settings.maxResults,
    ],
    queryFn: ({ signal }) => service.autocomplete(normalized, country, language, signal),
    enabled: settings.enabled && parsed.ok && parsed.value.kind !== 'coordinates' && normalized.length >= 2,
    staleTime: settings.searchStaleTimeMs,
    gcTime: Math.min(settings.searchStaleTimeMs, 60 * 60_000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

export function useLocationAutocomplete(
  service: LocationSearchService,
  settings: LocationSearchSettings,
  text: string,
  country: string | undefined,
  language: string,
) {
  const input = useMemo(
    () => ({ text: text.trim().normalize('NFC'), country, language }),
    [text, country, language],
  );
  const [settled, setSettled] = useState(input);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(input), settings.debounceMs);
    return () => clearTimeout(timer);
  }, [input, settings.debounceMs]);
  const options = locationSearchOptions(service, settings, input.text, country, language);
  return useQuery({ ...options, enabled: options.enabled === true && input === settled });
}

async function resolveLocation(
  api: ApiClient,
  client: QueryClient,
  settings: LocationSearchSettings,
  latitude: number,
  longitude: number,
  source: 'current' | 'coordinates' | 'search',
  signal?: AbortSignal,
  suggestion?: LocationSuggestion,
) {
  coordinatesSchema.parse({ latitude, longitude });
  const options = {
    staleTime: settings.resolveStaleTimeMs,
    gcTime: Math.min(settings.resolveStaleTimeMs, 24 * 60 * 60_000),
    retry: false as const,
  };
  // Only resolve timezone after selection; exact coordinates are part of the key.
  const timezone = await client.fetchQuery({
    ...options,
    queryKey: ['locations', 'timezone', latitude, longitude],
    queryFn: ({ signal: querySignal }) =>
      api.locations.timezone(latitude, longitude, { signal: signal ?? querySignal }),
  });
  if (signal?.aborted) throw new ApiError({ kind: 'cancelled' });
  if (!isIanaTimeZone(timezone.timeZone)) throw new ApiError({ kind: 'validation' });
  let place = suggestion;
  if (!place) {
    try {
      const reversed = await client.fetchQuery({
        ...options,
        queryKey: ['locations', 'reverse', latitude, longitude],
        queryFn: ({ signal: querySignal }) =>
          api.locations.reverse(latitude, longitude, undefined, { signal: signal ?? querySignal }),
      });
      place = reversed.place ?? undefined;
    } catch (error) {
      if (signal?.aborted) throw error;
      // A label is optional; a valid timezone and the user's coordinates are enough.
    }
  }
  if (signal?.aborted) throw new ApiError({ kind: 'cancelled' });
  return toPreciseSelectedLocation(
    {
      latitude,
      longitude,
      timeZone: timezone.timeZone,
      source,
      place: place
        ? {
            city: place.city,
            state: place.region,
            country: place.country,
            countryCode: place.countryCode,
            displayName: [place.city, place.region, place.country].filter(Boolean).join(', '),
          }
        : null,
    },
    { latitude, longitude },
    source,
    place,
  );
}

/** Provider-independent client abstraction. All network traffic uses the existing API transport and APIM origin. */
export function createLocationSearchService(
  api: ApiClient,
  client: QueryClient,
  settings: LocationSearchSettings,
): LocationSearchService {
  return {
    async autocomplete(text, country, language, signal) {
      const parsed = parseLocationInput(text);
      if (!parsed.ok || parsed.value.kind === 'coordinates') return [];
      const params = {
        text: parsed.value.kind === 'postalCode' ? parsed.value.postalCode : parsed.value.place,
        country,
        language,
        maxRows: settings.maxResults,
      };
      const response =
        parsed.value.kind === 'postalCode'
          ? await api.locations.postal(params, { signal })
          : await api.locations.search(params, { signal });
      return [...new Map(response.results.map((place) => [place.id, place])).values()].slice(
        0,
        settings.maxResults,
      );
    },
    resolveCoordinates: (latitude, longitude, source, signal) =>
      resolveLocation(api, client, settings, latitude, longitude, source, signal),
    select: (suggestion, signal) =>
      resolveLocation(
        api,
        client,
        settings,
        suggestion.latitude,
        suggestion.longitude,
        'search',
        signal,
        suggestion,
      ),
  };
}
