import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getWantReturnPlaces, getWishlist, type ListedPlace } from '@/data/journal';
import { useJournalRevision } from '@/data/journal-events';

type Lists = { wantToTry: ListedPlace[]; wantToGoBack: ListedPlace[] };

/**
 * The shared wishlist ("want to try") and "want to go back" places, re-queried after every
 * journal write. The previous lists stay visible while a refresh runs or if it fails.
 */
export function useWishlist() {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [attempt, setAttempt] = useState(0);
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getWishlist(db), getWantReturnPlaces(db)]).then(
      ([wantToTry, wantToGoBack]) => {
        if (cancelled) return;
        setLists({ wantToTry, wantToGoBack });
        setError(false);
      },
      () => {
        if (!cancelled) setError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, revision, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { lists, error, retry };
}
