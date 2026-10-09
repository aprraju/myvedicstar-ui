import {
  addRecentLocation,
  locateAndResolve,
  mayAutoDetect,
  recentLocationsSchema,
  type SelectedLocation,
  selectedLocationSchema,
} from '@myvedicstar/domain-models';
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
  removeRecent(id: string): void;
  detectCurrentLocation(): Promise<boolean>;
  dialogOpen: boolean;
  openDialog(): void;
  closeDialog(): void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Selected location for the whole app.
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
  const { api } = useServices();
  const [location, setLocation] = useState<SelectedLocation | null>(() => readStored(KEYS.selected));
  const [recent, setRecent] = useState<SelectedLocation[]>(
    () =>
      (preferenceStorage.read(KEYS.recent, recentLocationsSchema) as SelectedLocation[] | undefined) ?? [],
  );
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<DetectError | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Incremented whenever the user picks a location, so a slower automatic detection never overrides their choice.
  const choice = useRef(0);

  const select = useCallback((next: SelectedLocation) => {
    choice.current += 1;
    setLocation(next);
    setDetectError(null);
    preferenceStorage.write(KEYS.selected, next);
    setRecent((current) => {
      const updated = addRecentLocation(current, next);
      preferenceStorage.write(KEYS.recent, updated);
      return updated;
    });
  }, []);

  const removeRecent = useCallback((id: string) => {
    setRecent((current) => {
      const updated = current.filter((l) => l.id !== id);
      preferenceStorage.write(KEYS.recent, updated);
      return updated;
    });
  }, []);

  const detect = useCallback(
    async (automatic: boolean): Promise<boolean> => {
      const startedAt = choice.current;
      setDetecting(true);
      setDetectError(null);
      try {
        const located = await locateAndResolve(geolocation, (params) => api.locations.resolve(params));
        if (automatic && choice.current !== startedAt) return false;
        preferenceStorage.remove(KEYS.denied);
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
    [api, geolocation, select],
  );

  useEffect(() => {
    if (location) return;
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
    // Runs once at start-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      location,
      recent,
      detecting,
      detectError,
      select,
      removeRecent,
      detectCurrentLocation: () => detect(false),
      dialogOpen,
      openDialog: () => setDialogOpen(true),
      closeDialog: () => setDialogOpen(false),
    }),
    [location, recent, detecting, detectError, select, removeRecent, detect, dialogOpen],
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
