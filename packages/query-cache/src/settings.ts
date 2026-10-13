import type { ApiClient } from '@myvedicstar/api-client';
import type { SavedLocation, SaveSettings } from '@myvedicstar/contracts';
import type { SelectedLocation } from '@myvedicstar/domain-models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

export const settingsKey = (userId: string | undefined) => ['auth', 'settings', userId] as const;
export const savedLocationsKey = (userId: string | undefined) => ['auth', 'saved-locations', userId] as const;

export function toAccountLocation(value: SavedLocation): SelectedLocation {
  const label =
    [value.city, value.state, value.country].filter(Boolean).join(', ') ||
    `${value.latitude}, ${value.longitude}`;
  return {
    id: value.locationId,
    label,
    fullName: label,
    latitude: value.latitude,
    longitude: value.longitude,
    timeZone: value.timeZone,
    countryCode: value.countryCode ?? undefined,
    source: 'search',
    city: value.city ?? undefined,
    region: value.state ?? undefined,
    country: value.country ?? undefined,
    postalCode: value.postalCode ?? undefined,
  };
}
export function useAccountSettings(api: ApiClient, userId: string | undefined) {
  const cache = useQueryClient();
  const account = useRef(userId);
  useEffect(() => {
    account.current = userId;
  }, [userId]);
  const query = useQuery({
    queryKey: settingsKey(userId),
    queryFn: ({ signal }) => api.settings.get({ signal }),
    enabled: !!userId,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const save = useMutation({
    onMutate: () => ({ userId }),
    mutationFn: (request: SaveSettings) => api.settings.save(request),
    retry: false,
    onSuccess: (data, _request, context) => {
      if (context?.userId === account.current) cache.setQueryData(settingsKey(context.userId), data);
    },
  });
  return { query, save };
}
export function useSavedLocations(api: ApiClient, userId: string | undefined) {
  const cache = useQueryClient();
  const account = useRef(userId);
  useEffect(() => {
    account.current = userId;
  }, [userId]);
  const key = savedLocationsKey(userId);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.settings.locations({ signal }),
    enabled: !!userId,
    staleTime: 60_000,
    retry: false,
  });
  const add = useMutation({
    onMutate: () => ({ userId }),
    mutationFn: async (location: SelectedLocation) => {
      const existing = query.data?.find(
        (item) =>
          item.timeZone === location.timeZone &&
          item.latitude.toFixed(6) === location.latitude.toFixed(6) &&
          item.longitude.toFixed(6) === location.longitude.toFixed(6),
      );
      if (existing) return existing;
      return api.settings.addLocation({
        city: location.city ?? null,
        state: location.region ?? null,
        country: location.country ?? null,
        countryCode: location.countryCode ?? null,
        postalCode: location.postalCode ?? null,
        latitude: location.latitude,
        longitude: location.longitude,
        timeZone: location.timeZone,
      });
    },
    retry: false,
    onSuccess: (location, _request, context) => {
      if (context?.userId !== account.current) return;
      cache.setQueryData<SavedLocation[]>(savedLocationsKey(context.userId), (current) => [
        ...(current ?? []).filter((item) => item.locationId !== location.locationId),
        location,
      ]);
    },
  });
  const remove = useMutation({
    onMutate: () => ({ userId }),
    mutationFn: (id: string) => api.settings.deleteLocation(id),
    retry: false,
    onSuccess: (settings, id, context) => {
      if (context?.userId !== account.current) return;
      cache.setQueryData<SavedLocation[]>(key, (current) =>
        (current ?? []).filter((item) => item.locationId !== id),
      );
      cache.setQueryData(settingsKey(userId), settings);
    },
  });
  return { query, add, remove };
}
