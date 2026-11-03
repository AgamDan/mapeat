import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { useJournalRevision } from '@/data/journal-events';
import { getPhotosForVisits, type Photo } from '@/data/photos';

const EMPTY: Photo[] = [];

/**
 * Photos for a list of visits in one query (re-queried after journal writes). Returns a lookup
 * that gives `undefined` until loaded, so `VisitCard` can fall back to loading on its own.
 */
export function usePhotosForVisits(visitIds: readonly string[]) {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const key = visitIds.join(',');
  const [loaded, setLoaded] = useState<{ key: string; byVisit: Map<string, Photo[]> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(',') : [];
    getPhotosForVisits(db, ids)
      .catch(() => null)
      .then((byVisit) => {
        if (!cancelled && byVisit) setLoaded({ key, byVisit });
      });
    return () => {
      cancelled = true;
    };
  }, [db, key, revision]);

  const current = loaded && loaded.key === key ? loaded.byVisit : null;
  return (visitId: string): Photo[] | undefined => (current ? (current.get(visitId) ?? EMPTY) : undefined);
}
