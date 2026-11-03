import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { useJournalRevision } from '@/data/journal-events';
import { getAreaIndex } from '@/features/explorer/areas';
import { getVisitedPlaces, groupExplorer, type ExplorerSummary } from '@/features/explorer/explorer-data';

/**
 * Visited places grouped by city and approximate neighborhood, re-queried after every journal write.
 * `undefined` while the first load runs; `null` if it failed.
 */
export function useExplorer() {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [summary, setSummary] = useState<ExplorerSummary | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getVisitedPlaces(db)
      .then((places) => groupExplorer(places, getAreaIndex()))
      .catch(() => null)
      .then((result) => {
        if (!cancelled) setSummary(result);
      });
    return () => {
      cancelled = true;
    };
  }, [db, revision]);

  return summary;
}
