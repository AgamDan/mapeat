import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getWantReturnPlaces, getWishlist, type ListedPlace } from '@/data/journal';
import { useJournalRevision } from '@/data/journal-events';
import { getCoverPhotos, type Photo } from '@/data/photos';

/** A listed place plus its private journal cover, if one was chosen. */
export type WishlistPlace = ListedPlace & { cover: Photo | null };

type Lists = { wantToTry: WishlistPlace[]; wantToGoBack: WishlistPlace[] };

/** Both lists with their covers; a failed cover lookup only hides the thumbnails. */
async function loadLists(db: SQLiteDatabase): Promise<Lists> {
  const [wantToTry, wantToGoBack] = await Promise.all([getWishlist(db), getWantReturnPlaces(db)]);
  const ids = [...new Set([...wantToTry, ...wantToGoBack].map((place) => place.placeId))];
  const covers = await getCoverPhotos(db, ids).catch(() => new Map<string, Photo>());
  const withCover = (place: ListedPlace): WishlistPlace => ({ ...place, cover: covers.get(place.placeId) ?? null });
  return { wantToTry: wantToTry.map(withCover), wantToGoBack: wantToGoBack.map(withCover) };
}

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
    loadLists(db).then(
      (result) => {
        if (cancelled) return;
        setLists(result);
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
