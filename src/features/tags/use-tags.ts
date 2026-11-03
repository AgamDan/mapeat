import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getPlaceTags, listTags, type Tag } from '@/data/journal';
import { useJournalRevision } from '@/data/journal-events';

/** All tags, alphabetical, re-queried after every journal write. `null` until first loaded. */
export function useAllTags() {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [attempt, setAttempt] = useState(0);
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listTags(db).then(
      (result) => {
        if (cancelled) return;
        setTags(result);
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
  return { tags, error, retry };
}

type PlaceTagsState = { placeId: string; tags: Tag[] | null; error: boolean };

/** One place's tags, alphabetical, re-queried after every journal write. */
export function usePlaceTags(placeId: string | undefined) {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PlaceTagsState | null>(null);

  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    getPlaceTags(db, placeId).then(
      (tags) => {
        if (!cancelled) setState({ placeId, tags, error: false });
      },
      () => {
        if (!cancelled) {
          setState((previous) =>
            previous?.placeId === placeId ? { ...previous, error: true } : { placeId, tags: null, error: true },
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, placeId, revision, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current = state?.placeId === placeId ? state : null;
  return { tags: current?.tags ?? null, error: current?.error ?? false, retry };
}
