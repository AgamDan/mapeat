import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { useJournalRevision } from '@/data/journal-events';
import { getCoverPhoto, getMenuPhotos, type Photo } from '@/data/photos';

type MenuState = { placeId: string; photos: Photo[] | null; error: boolean };

/**
 * A place's private menu photos (newest first), re-queried after every journal write. The
 * previous list stays visible while a refresh runs or if it fails.
 */
export function useMenuPhotos(placeId: string | undefined) {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<MenuState | null>(null);

  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    getMenuPhotos(db, placeId).then(
      (photos) => {
        if (!cancelled) setState({ placeId, photos, error: false });
      },
      () => {
        if (!cancelled) {
          setState((previous) =>
            previous?.placeId === placeId ? { ...previous, error: true } : { placeId, photos: null, error: true },
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
  return { photos: current?.photos ?? null, error: current?.error ?? false, retry };
}

/** The place's private journal cover (`null` if none or not loaded), kept fresh after writes. */
export function useCoverPhoto(placeId: string | undefined) {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [state, setState] = useState<{ placeId: string; cover: Photo | null } | null>(null);

  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    getCoverPhoto(db, placeId).then(
      (cover) => {
        if (!cancelled) setState({ placeId, cover });
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [db, placeId, revision]);

  return state && state.placeId === placeId ? state.cover : null;
}
