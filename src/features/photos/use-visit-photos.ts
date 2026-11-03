import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { useJournalRevision } from '@/data/journal-events';
import { getVisitPhotos, type Photo } from '@/data/photos';

/**
 * A visit's photos, re-queried after every journal write. `undefined` while loading.
 * Pass `skip` when the photos are already known (e.g. batch-loaded for a list).
 */
export function useVisitPhotos(visitId: string, skip = false) {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [loaded, setLoaded] = useState<{ visitId: string; photos: Photo[] } | null>(null);

  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    getVisitPhotos(db, visitId)
      .catch(() => [])
      .then((photos) => {
        if (!cancelled) setLoaded({ visitId, photos });
      });
    return () => {
      cancelled = true;
    };
  }, [db, visitId, revision, skip]);

  return loaded && loaded.visitId === visitId ? loaded.photos : undefined;
}
