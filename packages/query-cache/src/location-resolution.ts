import { ApiError } from '@myvedicstar/api-client';
import type { LocationSuggestion } from '@myvedicstar/contracts';
import type { SelectedLocation } from '@myvedicstar/domain-models';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { LocationSearchService } from './location-search';

type Selection = { suggestion: LocationSuggestion } | { latitude: number; longitude: number };

/** Cancels discarded choices and detaches observers so a late response cannot commit an obsolete selection. */
export function useLocationResolution(
  service: LocationSearchService,
  onChoose: (location: SelectedLocation) => void,
) {
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const mutation = useMutation({
    mutationFn: async ({
      selection,
      version,
      confirm,
    }: {
      selection: Selection;
      version: number;
      confirm: boolean;
    }) => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      const location =
        'suggestion' in selection
          ? await service.select(selection.suggestion, current.signal)
          : await service.resolveCoordinates(
              selection.latitude,
              selection.longitude,
              'coordinates',
              current.signal,
            );
      if (current.signal.aborted || version !== generation.current) throw new ApiError({ kind: 'cancelled' });
      return { location, confirm };
    },
    onSuccess: (data, variables) => {
      if (!data.confirm && variables.version === generation.current) onChoose(data.location);
    },
  });
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  return {
    ...mutation,
    resolve: (selection: Selection, confirm = false) =>
      mutation.mutate({ selection, confirm, version: ++generation.current }),
    reset: () => {
      generation.current++;
      controller.current?.abort();
      mutation.reset();
    },
  };
}
