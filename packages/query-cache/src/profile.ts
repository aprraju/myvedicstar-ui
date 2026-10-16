import type { ApiClient } from '@myvedicstar/api-client';
import { profileChanges, type ProfileField, profileValues, type UserProfile } from '@myvedicstar/contracts';
import { validateProfile } from '@myvedicstar/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { seedUserInfo } from './user-info';

export function useProfileEditor(api: ApiClient, userId: string | undefined) {
  const cache = useQueryClient();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, [userId]);
  const key = ['auth', 'profile', userId] as const;
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.auth.profile({ signal }),
    enabled: !!userId,
    staleTime: 60_000,
    retry: false,
  });
  const [edits, setEdits] = useState<Partial<Record<ProfileField, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const values = { ...profileValues(query.data), ...edits };
  const accept = async (profile: UserProfile) => {
    if (!alive.current) return;
    cache.setQueryData(key, profile);
    // Keep the header and greeting in step with the saved names (the login response is not requested again).
    if (userId)
      seedUserInfo(cache, userId, {
        id: userId,
        name: profile.displayName,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
      });
    setEdits({});
  };
  const save = useMutation({
    mutationFn: () => {
      if (!query.data) throw new Error('Load your profile before saving.');
      return api.auth.updateProfile(profileChanges(values, query.data));
    },
    onSuccess: accept,
    retry: false,
  });
  const sync = useMutation({
    mutationFn: () => api.auth.retryProfileSync(),
    onSuccess: accept,
    retry: false,
  });
  const busy = save.isPending || sync.isPending;
  const change = (field: ProfileField, value: string) => {
    if (busy) return;
    setEdits((previous) => ({
      ...previous,
      [field]: value,
      ...(field === 'country'
        ? { state: '', city: '', postalCode: '' }
        : field === 'state'
          ? { city: '', postalCode: '' }
          : {}),
    }));
    setErrors({});
    save.reset();
  };
  return {
    query,
    values,
    errors,
    save,
    sync,
    busy,
    change,
    dirty: !!query.data && Object.keys(profileChanges(values, query.data).changes).length > 0,
    selectPlace: (place: {
      city: string;
      region: string | null;
      countryCode: string;
      postalCode: string | null;
    }) => {
      if (!busy)
        setEdits((previous) => ({
          ...previous,
          country: place.countryCode,
          state: place.region ?? (place.countryCode === values.country ? values.state : ''),
          city: place.city,
          postalCode:
            place.postalCode ??
            (place.countryCode === values.country &&
            place.region === values.state &&
            place.city === values.city
              ? values.postalCode
              : ''),
        }));
    },
    submit: () => {
      if (busy || !query.data) return;
      const nextErrors = validateProfile(values);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length === 0) save.mutate();
    },
  };
}

/** Uses the existing GeoNames adapter and TanStack cache; manual input never depends on lookup availability. */
export function useProfileGeography(
  api: ApiClient,
  country: string,
  state: string,
  city: string,
  postalCode: string,
  enabled: boolean,
) {
  const [settled, setSettled] = useState({ country, state, city, postalCode });
  useEffect(() => {
    const timer = setTimeout(() => setSettled({ country, state, city, postalCode }), 350);
    return () => clearTimeout(timer);
  }, [country, state, city, postalCode]);
  const options = { staleTime: 24 * 60 * 60_000, retry: false as const, refetchOnWindowFocus: false };
  const countries = useQuery({
    ...options,
    queryKey: ['locations', 'countries'],
    queryFn: ({ signal }) => api.locations.countries({ signal }),
    enabled,
  });
  const code = /^[A-Z]{2}$/.test(country) ? country : undefined;
  const regions = useQuery({
    ...options,
    queryKey: ['locations', 'regions', code],
    queryFn: ({ signal }) => api.locations.regions(code ?? '', { signal }),
    enabled: enabled && !!code,
  });
  const region = regions.data?.results.find((item) => item.name === state || item.code === state)?.code;
  const current = settled.country === country && settled.state === state;
  const cities = useQuery({
    ...options,
    queryKey: ['locations', 'address-cities', code, region, settled.city],
    queryFn: ({ signal }) => api.locations.addressCities(settled.city, code, region, { signal }),
    enabled: enabled && !!code && current && settled.city === city && city.trim().length >= 2,
  });
  const postal = useQuery({
    ...options,
    queryKey: ['locations', 'address-postal', code, settled.postalCode],
    queryFn: ({ signal }) => api.locations.postal({ country: code, text: settled.postalCode }, { signal }),
    enabled:
      enabled &&
      !!code &&
      current &&
      settled.postalCode === postalCode &&
      /^[A-Za-z0-9 -]{2,10}$/.test(postalCode),
  });
  return { countries, regions, cities, postal };
}
