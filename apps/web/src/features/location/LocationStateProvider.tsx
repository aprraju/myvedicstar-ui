import {
  addRecentLocation,
  locateAndResolve,
  mayAutoDetect,
  recentLocationsSchema,
  type SelectedLocation,
  selectedLocationSchema,
} from '@myvedicstar/domain-models';
import {
  accountStartLocation,
  toAccountLocation,
  useAccountSettings,
  useSavedLocations,
} from '@myvedicstar/query-cache';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { z } from 'zod';

import { useAuth } from '../../shared/auth';
import { useServices } from '../../shared/services/ServicesContext';
import { preferenceStorage } from '../../shared/storage/preference-storage';
import {
  browserGeolocation,
  GeolocationError,
  type GeolocationErrorKind,
  type GeolocationProvider,
} from './geolocation';

const KEYS = {
  selected: 'location.selected',
  recent: 'location.recent',
  denied: 'location.permissionDenied',
};

export type DetectError =
  { kind: 'geolocation'; reason: GeolocationErrorKind } | { kind: 'api'; error: unknown };

interface LocationContextValue {
  location: SelectedLocation | null;
  recent: readonly SelectedLocation[];
  /** `detecting` while the current position is being determined and resolved. */
  detecting: boolean;
  detectError: DetectError | null;
  select(location: SelectedLocation): void;
  applyDefault(location: SelectedLocation | null): void;
  savingError: boolean;
  retrySave(): void;
  removeRecent(id: string): void;
  detectCurrentLocation(): Promise<boolean>;
  dialogOpen: boolean;
  openDialog(): void;
  closeDialog(): void;
  /**
   * Optional per-dialog override for `select`. The location dialog is shared (there is exactly one), so a caller that
   * needs its own selection sink — e.g. a birth location that belongs to a form, not the app header — registers a
   * handler and unregisters it on unmount. When nothing is registered the dialog keeps today's app-global behaviour.
   */
  overrideSelect(handler: ((location: SelectedLocation) => void) | null): void;
  selectOverride: ((location: SelectedLocation) => void) | null;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Selected location for the whole app.
 *
 * After login: the account's default location, else its first saved location; without either, the existing behaviour.
 * Locations picked while signed in are saved to the account (never twice).
 *
 * Start-up: a saved location is used as-is. Otherwise, if the browser allows it (permission already granted, or not yet
 * asked), the current position is requested once. A denial is remembered and never re-prompted automatically; manual
 * search always works.
 */
export function LocationStateProvider({
  children,
  geolocation = browserGeolocation,
}: {
  children: ReactNode;
  geolocation?: GeolocationProvider;
}) {
  const { api, config, locationSearch } = useServices();
  const { user } = useAuth();
  const userId = user?.id;
  const { query: accountSettings } = useAccountSettings(api, userId);
  const saved = useSavedLocations(api, userId);
  const addSaved = saved.add.mutate;
  const deleteSaved = saved.remove.mutate;
  const defaultsApplied = useRef<string | undefined>(undefined);
  const anonymous = useRef<SelectedLocation | null>(readStored(KEYS.selected));
  const [location, setLocation] = useState<SelectedLocation | null>(() => readStored(KEYS.selected));
  const [recent, setRecent] = useState<SelectedLocation[]>(
    () =>
      (preferenceStorage.read(KEYS.recent, recentLocationsSchema) as SelectedLocation[] | undefined) ?? [],
  );
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<DetectError | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Several selectors can be mounted at once (the header and a form). Each registration is pushed onto a stack:
  // the most recent registrant owns the dialog, and unmounting it restores whoever registered before, instead of
  // clearing the sink for everyone. Without this the header (rendered after the page) wins and a form never
  // receives its own pick.
  const [selectOverrides, setSelectOverrides] = useState<readonly ((location: SelectedLocation) => void)[]>(
    [],
  );
  const selectOverride = selectOverrides[selectOverrides.length - 1] ?? null;
  // Mirror it in a ref so async paths (position detection) read the current handler, not a stale closure.
  const selectOverrideRef = useRef<((location: SelectedLocation) => void) | null>(null);
  useEffect(() => {
    selectOverrideRef.current = selectOverride;
  }, [selectOverride]);

  const registerOverride = useCallback((handler: ((location: SelectedLocation) => void) | null) => {
    setSelectOverrides((current) => {
      if (!handler) return current.slice(0, -1);
      return current[current.length - 1] === handler ? current : [...current, handler];
    });
  }, []);
  // Incremented whenever the user picks a location, so a slower automatic detection never overrides their choice.
  const choice = useRef(0);

  const select = useCallback(
    (next: SelectedLocation) => {
      choice.current += 1;
      setLocation(next);
      if (userId) {
        defaultsApplied.current = userId;
        addSaved(next);
        setDetectError(null);
        return;
      }
      anonymous.current = next;
      setDetectError(null);
      preferenceStorage.write(KEYS.selected, next);
      setRecent((current) => {
        const updated = addRecentLocation(current, next, config.locationSearch.recentLimit);
        preferenceStorage.write(KEYS.recent, updated);
        return updated;
      });
    },
    [config.locationSearch.recentLimit, userId, addSaved],
  );

  const removeRecent = useCallback(
    (id: string) => {
      if (userId) {
        deleteSaved(id, {
          onSuccess: () => {
            if (accountSettings.data?.defaultLocationId === id) setLocation(anonymous.current);
          },
        });
        return;
      }
      setRecent((current) => {
        const updated = current.filter((l) => l.id !== id);
        preferenceStorage.write(KEYS.recent, updated);
        return updated;
      });
    },
    [userId, deleteSaved, accountSettings.data?.defaultLocationId],
  );

  const detect = useCallback(
    async (automatic: boolean): Promise<boolean> => {
      if (!userId || (automatic && config.locationSearch.enabled)) return false;
      const startedAt = choice.current;
      setDetecting(true);
      setDetectError(null);
      try {
        const located = config.locationSearch.enabled
          ? await geolocation
              .getCurrentPosition()
              .then((position) =>
                locationSearch.resolveCoordinates(position.latitude, position.longitude, 'current'),
              )
          : await locateAndResolve(geolocation, (params) => api.locations.resolve(params));
        if (choice.current !== startedAt) return false;
        preferenceStorage.remove(KEYS.denied);
        // A form that owns the dialog (e.g. a profile birth location) gets the pick instead of the app.
        // Global state, saved locations and persistence must not move for a value that belongs to that form.
        const sink = selectOverrideRef.current;
        if (sink) {
          sink(located);
          return true;
        }
        select(located);
        return true;
      } catch (error) {
        if (error instanceof GeolocationError) {
          if (error.kind === 'permissionDenied') preferenceStorage.write(KEYS.denied, true);
          setDetectError({ kind: 'geolocation', reason: error.kind });
        } else {
          setDetectError({ kind: 'api', error });
        }
        return false;
      } finally {
        setDetecting(false);
      }
    },
    [api, config.locationSearch.enabled, geolocation, locationSearch, select, userId],
  );

  useEffect(() => {
    if (
      !userId ||
      location ||
      config.locationSearch.enabled ||
      accountSettings.isPending ||
      accountSettings.data?.defaultLocation ||
      saved.query.isPending ||
      saved.query.data?.length
    )
      return;
    const denied = preferenceStorage.read(KEYS.denied, z.boolean()) ?? false;
    let active = true;
    void geolocation.permission().then((permission) => {
      if (!active) return;
      if (permission === 'denied') preferenceStorage.write(KEYS.denied, true);
      if (mayAutoDetect(permission, denied)) void detect(true);
    });
    return () => {
      active = false;
    };
    // Detect only after account registration and settings have settled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, accountSettings.isPending, saved.query.isPending]);

  useEffect(() => {
    if (!userId) {
      if (defaultsApplied.current) setLocation(anonymous.current);
      defaultsApplied.current = undefined;
      return;
    }
    if (defaultsApplied.current === userId) return;
    const start = accountStartLocation(accountSettings, saved.query);
    if (start === undefined) return;
    defaultsApplied.current = userId;
    if (start) setLocation(start);
  }, [userId, accountSettings, saved.query]);

  const accountRecent = userId ? (saved.query.data ?? []).map(toAccountLocation) : recent;
  const applyDefault = useCallback(
    (next: SelectedLocation | null) => {
      defaultsApplied.current = userId;
      setLocation(next ?? anonymous.current);
    },
    [userId],
  );
  const savingError = saved.add.isError || saved.remove.isError || (!!userId && saved.query.isError);
  const retrySave = useCallback(() => {
    if (saved.add.isError && saved.add.variables) addSaved(saved.add.variables);
    else if (saved.remove.isError && saved.remove.variables) deleteSaved(saved.remove.variables);
    else void saved.query.refetch();
  }, [
    saved.add.isError,
    saved.add.variables,
    saved.remove.isError,
    saved.remove.variables,
    saved.query,
    addSaved,
    deleteSaved,
  ]);

  const value = useMemo<LocationContextValue>(
    () => ({
      location,
      recent: accountRecent,
      applyDefault,
      savingError,
      retrySave,
      detecting,
      detectError,
      select,
      removeRecent,
      detectCurrentLocation: () => detect(false),
      dialogOpen,
      openDialog: () => setDialogOpen(true),
      closeDialog: () => setDialogOpen(false),
      overrideSelect: registerOverride,
      selectOverride,
    }),
    [
      location,
      accountRecent,
      applyDefault,
      savingError,
      retrySave,
      detecting,
      detectError,
      select,
      removeRecent,
      detect,
      dialogOpen,
      selectOverride,
      registerOverride,
    ],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationState(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocationState must be used inside <LocationStateProvider>');
  return context;
}

function readStored(key: string): SelectedLocation | null {
  return (preferenceStorage.read(key, selectedLocationSchema) as SelectedLocation | undefined) ?? null;
}
