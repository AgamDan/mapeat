import { useSyncExternalStore } from 'react';

/**
 * A one-shot request for the Map tab to fly to a place and open it (e.g. from search).
 * The map consumes it with `takeMapFocus()` so it runs once.
 */
export type MapFocus = { placeId: string; latitude: number; longitude: number; requestedAt: number };

let pending: MapFocus | null = null;
const listeners = new Set<() => void>();

export function requestMapFocus(focus: Omit<MapFocus, 'requestedAt'>) {
  pending = { ...focus, requestedAt: Date.now() };
  for (const listener of listeners) listener();
}

/** Returns the pending focus request (if any) and clears it. */
export function takeMapFocus() {
  const focus = pending;
  pending = null;
  return focus;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The pending request, re-rendering when a new one arrives. */
export function usePendingMapFocus() {
  return useSyncExternalStore(subscribe, () => pending);
}
