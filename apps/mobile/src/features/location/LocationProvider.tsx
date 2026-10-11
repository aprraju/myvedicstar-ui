import {
  addRecentLocation,
  GeolocationError,
  type GeolocationErrorKind,
  type GeolocationProvider,
  locateAndResolve,
  mayAutoDetect,
  parseStoredLocation,
  parseStoredRecentLocations,
  type SelectedLocation,
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

import { useServices } from '../../shared/services';
import { preferenceStorage } from '../../shared/storage';
import { expoGeolocation } from './geolocation';

const KEYS = {
  selected: 'location.selected',
  recent: 'location.recent',
  denied: 'location.permissionDenied',
};

export type DetectError =
  { kind: 'geolocation'; reason: GeolocationErrorKind } | { kind: 'api'; error: unknown };

interface LocationContextValue {
  /** False until stored preferences have been read (AsyncStorage is asynchronous). */
  ready: boolean;
  location: SelectedLocation | null;
  recent: readonly SelectedLocation[];
  detecting: boolean;
  detectError: DetectError | null;
  select(location: SelectedLocation): void;
  removeRecent(id: string): void;
  detectCurrentLocation(): Promise<boolean>;
  sheetOpen: boolean;
  openSheet(): void;
  closeSheet(): void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Selected location for the app (mobile). Same behaviour as web: a saved location wins; otherwise the current
 * position is requested once if the OS allows asking; a denial is remembered; manual search always works.
 */
export function LocationProvider({
  children,
  geolocation = expoGeolocation,
}: {
  children: ReactNode;
  geolocation?: GeolocationProvider;
}) {
  const { api, config, locationSearch } = useServices();
  const [ready, setReady] = useState(false);
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [recent, setRecent] = useState<SelectedLocation[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<DetectError | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const choice = useRef(0);

  const select = useCallback(
    (next: SelectedLocation) => {
      choice.current += 1;
      setLocation(next);
      setDetectError(null);
      void preferenceStorage.write(KEYS.selected, next);
      setRecent((current) => {
        const updated = addRecentLocation(current, next, config.locationSearch.recentLimit);
        void preferenceStorage.write(KEYS.recent, updated);
        return updated;
      });
    },
    [config.locationSearch.recentLimit],
  );

  const removeRecent = useCallback((id: string) => {
    setRecent((current) => {
      const updated = current.filter((l) => l.id !== id);
      void preferenceStorage.write(KEYS.recent, updated);
      return updated;
    });
  }, []);

  const detect = useCallback(
    async (automatic: boolean) => {
      if (automatic && config.locationSearch.enabled) return false;
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
        void preferenceStorage.remove(KEYS.denied);
        select(located);
        return true;
      } catch (error) {
        if (error instanceof GeolocationError) {
          if (error.kind === 'permissionDenied') void preferenceStorage.write(KEYS.denied, true);
          setDetectError({ kind: 'geolocation', reason: error.kind });
        } else {
          setDetectError({ kind: 'api', error });
        }
        return false;
      } finally {
        setDetecting(false);
      }
    },
    [api, config.locationSearch.enabled, geolocation, locationSearch, select],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const [stored, storedRecent, denied] = await Promise.all([
        preferenceStorage.read(KEYS.selected, parseStoredLocation),
        preferenceStorage.read(KEYS.recent, parseStoredRecentLocations),
        preferenceStorage.read(KEYS.denied, (v) => (typeof v === 'boolean' ? v : undefined)),
      ]);
      if (!active) return;
      setRecent(storedRecent ?? []);
      if (stored) setLocation(stored);
      setReady(true);
      if (stored || config.locationSearch.enabled) return;
      const permission = await geolocation.permission();
      if (active && mayAutoDetect(permission, denied ?? false)) void detect(true);
    })();
    return () => {
      active = false;
    };
    // Runs once at start-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      ready,
      location,
      recent,
      detecting,
      detectError,
      select,
      removeRecent,
      detectCurrentLocation: () => detect(false),
      sheetOpen,
      openSheet: () => setSheetOpen(true),
      closeSheet: () => setSheetOpen(false),
    }),
    [ready, location, recent, detecting, detectError, select, removeRecent, detect, sheetOpen],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationState(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocationState must be used inside <LocationProvider>');
  return context;
}
