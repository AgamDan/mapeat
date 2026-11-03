import { useSyncExternalStore } from 'react';

/**
 * A one-shot request for the Map tab to fly to a place and open it (e.g. from search).
 * The map consumes it with `takeMapFocus()` so it runs once.
 */
export type MapFocus = { placeId: string; latitude: number; longitude: number; requestedAt: number };

let pending: MapFocus | null = null;
/** Increments only when a new request arrives, so re-renders never re-trigger handling. */
let version = 0;
const listeners = new Set<() => void>();

export function requestMapFocus(focus: Omit<MapFocus, 'requestedAt'>) {
  pending = { ...focus, requestedAt: Date.now() };
  version++;
  for (const listener of listeners) listener();
}

/** Returns the pending focus request (if any) and clears it. Does not notify. */
export function takeMapFocus() {
  const focus = pending;
  pending = null;
  return focus;
}

/**
 * Puts back a request that was interrupted before the place opened, unless a newer one is already
 * waiting. Silent: it is handled the next time the map gains focus.
 */
export function restoreMapFocus(focus: MapFocus) {
  if (!pending) pending = focus;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A number that changes only when a new focus request arrives. */
export function useMapFocusVersion() {
  return useSyncExternalStore(subscribe, () => version);
}
