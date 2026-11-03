import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getPlaceDishSummary, getVisitDishes, type Dish, type PlaceDishSummary } from '@/data/dishes';
import { useJournalRevision } from '@/data/journal-events';

/** A visit's dishes (`undefined` while loading), re-queried after every journal write. */
export function useVisitDishes(visitId: string) {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [loaded, setLoaded] = useState<{ visitId: string; dishes: Dish[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVisitDishes(db, visitId)
      .catch(() => [])
      .then((dishes) => {
        if (!cancelled) setLoaded({ visitId, dishes });
      });
    return () => {
      cancelled = true;
    };
  }, [db, visitId, revision]);

  return loaded && loaded.visitId === visitId ? loaded.dishes : undefined;
}

/** The place's dish summary (`undefined` while loading), re-queried after every journal write. */
export function usePlaceDishSummary(placeId: string) {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [loaded, setLoaded] = useState<{ placeId: string; summary: PlaceDishSummary[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPlaceDishSummary(db, placeId)
      .catch(() => [])
      .then((summary) => {
        if (!cancelled) setLoaded({ placeId, summary });
      });
    return () => {
      cancelled = true;
    };
  }, [db, placeId, revision]);

  return loaded && loaded.placeId === placeId ? loaded.summary : undefined;
}
