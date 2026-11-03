import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { useJournalRevision } from '@/data/journal-events';
import type { MapPlace } from '@/data/journal';
import { getMapPhotoFiles } from '@/data/photos';

const NONE: ReadonlyMap<string, string> = new Map();

/**
 * Photo file names for the visited places on the map (main photo, else newest visit photo),
 * loaded only while `enabled` (zoomed in close). Re-queried after journal writes.
 */
export function useMapPhotos(places: readonly MapPlace[], enabled: boolean) {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const key = enabled
    ? places
        .filter((place) => place.status === 'visited')
        .map((place) => place.id)
        .sort()
        .join(',')
    : '';
  const [loaded, setLoaded] = useState<{ key: string; files: ReadonlyMap<string, string> } | null>(null);

  useEffect(() => {
    if (!key) return;
    let active = true;
    getMapPhotoFiles(db, key.split(','))
      .then((files) => {
        if (active) setLoaded({ key, files });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [db, key, revision]);

  // While a new set loads, keep the last photos for places still shown (no flicker on small pans).
  if (!key) return NONE;
  return loaded?.files ?? NONE;
}
