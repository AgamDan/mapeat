import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { useJournalRevision } from '@/data/journal-events';
import { getPlaceJournal, type PlaceJournal } from '@/data/visits';

type State = { placeId: string; journal: PlaceJournal | null; error: boolean };

/**
 * A place's journal (visits newest first + each person's average), re-queried after every
 * journal write. The previous result stays visible while a refresh is running.
 */
export function usePlaceJournal(placeId: string | undefined) {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    getPlaceJournal(db, placeId).then(
      (journal) => {
        if (!cancelled) setState({ placeId, journal, error: false });
      },
      () => {
        if (!cancelled) {
          setState((previous) =>
            previous?.placeId === placeId
              ? { ...previous, error: true }
              : { placeId, journal: null, error: true },
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, placeId, revision, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current = state && state.placeId === placeId ? state : null;
  const journal = current?.journal ?? null;
  const error = current?.error ?? false;

  return { journal, loading: journal === null && !error, error, retry };
}
