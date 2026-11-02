import { useSyncExternalStore } from 'react';

/**
 * A tiny change signal for journal data. Writes call `notifyJournalChanged()`; screens read
 * `useJournalRevision()` and re-query when it changes.
 */
let revision = 0;
const listeners = new Set<() => void>();

export function notifyJournalChanged() {
  revision++;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useJournalRevision() {
  return useSyncExternalStore(subscribe, () => revision);
}
