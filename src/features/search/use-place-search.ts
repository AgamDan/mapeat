import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { searchPlaces, type MapPlace } from '@/data/journal';
import { getMapCenter } from '@/features/map/map-center-store';

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 50;

export type PlaceSearch =
  | { state: 'idle' }
  /** `results` are the previous query's, kept on screen while the new one runs (or null). */
  | { state: 'searching'; results: MapPlace[] | null }
  | { state: 'done'; results: MapPlace[] }
  | { state: 'error' };

type Answer = { text: string; attempt: number; results: MapPlace[] | null };

/**
 * Debounced name search over every place cached on the phone (ties ranked nearest to the map
 * center). Only the latest query's answer is kept; slower, older answers are dropped.
 * Bump `attempt` to retry after an error.
 */
export function usePlaceSearch(query: string, attempt: number): PlaceSearch {
  const db = useSQLiteContext();
  const text = query.trim();
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (!text) return;
    let current = true;
    const timer = setTimeout(() => {
      searchPlaces(db, text, RESULT_LIMIT, getMapCenter() ?? undefined).then(
        (results) => {
          if (current) setAnswer({ text, attempt, results });
        },
        () => {
          if (current) setAnswer({ text, attempt, results: null });
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [db, text, attempt]);

  if (!text) return { state: 'idle' };
  if (answer?.text === text && answer.attempt === attempt) {
    return answer.results ? { state: 'done', results: answer.results } : { state: 'error' };
  }
  return { state: 'searching', results: answer?.results ?? null };
}
