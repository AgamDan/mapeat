import { useSyncExternalStore } from 'react';

import { DEFAULT_MAP_FILTER, type MapFilter } from '@/data/journal';

/**
 * The map's current filter, shared between the Map tab and the filter sheet. Lives for the app
 * session only (the map opens unfiltered after a restart).
 */
let current: MapFilter = DEFAULT_MAP_FILTER;
const listeners = new Set<() => void>();

export function getMapFilter() {
  return current;
}

export function setMapFilter(next: MapFilter) {
  current = next;
  for (const listener of listeners) listener();
}

export function resetMapFilter() {
  setMapFilter(DEFAULT_MAP_FILTER);
}

/** Number of active filter groups (for a badge on the filter button). */
export function activeFilterCount(filter: MapFilter) {
  return (
    (filter.show !== 'all' ? 1 : 0) +
    (filter.kinds.length > 0 ? 1 : 0) +
    (filter.cuisine ? 1 : 0) +
    (filter.tagIds.length > 0 ? 1 : 0)
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMapFilter() {
  return useSyncExternalStore(subscribe, getMapFilter);
}
