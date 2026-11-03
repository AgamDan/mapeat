import { useSyncExternalStore } from 'react';

/**
 * OSM cuisine values among the places currently loaded on the map, so the filter sheet can
 * offer only cuisines that exist here. Written by the Map tab, read by the filter sheet.
 */
let current: readonly string[] = [];
const listeners = new Set<() => void>();

export function setVisibleCuisines(next: readonly string[]) {
  if (next.length === current.length && next.every((value, index) => value === current[index])) return;
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVisibleCuisines() {
  return useSyncExternalStore(subscribe, () => current);
}
