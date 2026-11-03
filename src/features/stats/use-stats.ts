import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { useJournalRevision } from '@/data/journal-events';
import { getStats, type JournalStats } from '@/data/stats';

/**
 * Journal stats for the current calendar year, re-queried after every journal write.
 * `undefined` while the first load runs; `null` if it failed.
 */
export function useStats() {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const year = new Date().getFullYear();
  const [stats, setStats] = useState<JournalStats | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getStats(db, year)
      .catch(() => null)
      .then((result) => {
        if (!cancelled) setStats(result);
      });
    return () => {
      cancelled = true;
    };
  }, [db, year, revision]);

  return stats;
}

/** One decimal, without a trailing ".0" (8 → "8", 8.25 → "8.3"). */
export function formatAverage(value: number) {
  return String(Math.round(value * 10) / 10);
}
