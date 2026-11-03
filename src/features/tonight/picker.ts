import type { TonightCandidate } from '@/data/tonight';
import { distanceMeters, type LatLon } from '@/features/tonight/geo';

/** Distance chips, in km; `null` = anywhere. */
export const TONIGHT_DISTANCES = [2, 5, 15, null] as const;
export type TonightDistance = (typeof TONIGHT_DISTANCES)[number];
export const DEFAULT_TONIGHT_DISTANCE: TonightDistance = 5;

export type RankedCandidate = TonightCandidate & { distanceM: number | null };

/** Candidates within `km` of `from` (all of them if `km` or `from` is null), with their distance. */
export function candidatesWithin(
  candidates: readonly TonightCandidate[],
  from: LatLon | null,
  km: TonightDistance,
): RankedCandidate[] {
  const ranked = candidates.map((place) => ({ ...place, distanceM: from ? distanceMeters(from, place) : null }));
  if (km == null || !from) return ranked;
  return ranked.filter((place) => place.distanceM! <= km * 1000);
}

/** Which places were already shown in this round, and the one on screen now. */
export type PickHistory = { seen: readonly string[]; last: string | null };

export const EMPTY_HISTORY: PickHistory = { seen: [], last: null };

/**
 * Picks a random place id: never the one on screen (unless it is the only one), and every place
 * once before any repeats. When all have been shown, a new round starts.
 */
export function pickNext(
  ids: readonly string[],
  history: PickHistory,
  random: () => number = Math.random,
): { id: string; history: PickHistory } | null {
  if (ids.length === 0) return null;
  const notLast = ids.length > 1 ? ids.filter((id) => id !== history.last) : [...ids];
  let seen = history.seen.filter((id) => ids.includes(id));
  let pool = notLast.filter((id) => !seen.includes(id));
  if (pool.length === 0) {
    seen = [];
    pool = notLast;
  }
  const id = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return { id, history: { seen: [...seen, id], last: id } };
}
