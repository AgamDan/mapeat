import type { SQLiteDatabase } from 'expo-sqlite';

import type { MapPlace } from '@/data/journal';
import { toVenue, type PlaceRow } from '@/data/places';

/** Why a place is a "Where tonight?" candidate. */
export type TonightReason = 'wishlist' | 'goBack';

export type TonightCandidate = MapPlace & { reason: TonightReason };

type Row = PlaceRow & { is_visited: number; wishlist: number; want_return: number };

/**
 * Places for "Where tonight?": the wishlist (places not visited yet) plus places marked
 * "want to go back". Each place appears once; a wishlist place that already has a visit only
 * counts if it is marked "want to go back".
 */
export async function getTonightCandidates(db: SQLiteDatabase): Promise<TonightCandidate[]> {
  const visited = 'EXISTS (SELECT 1 FROM visits v WHERE v.place_id = p.id)';
  const rows = await db.getAllAsync<Row>(
    `SELECT p.*, ${visited} AS is_visited, jp.wishlist, jp.want_return
     FROM journal_places jp JOIN places p ON p.id = jp.place_id
     WHERE (jp.wishlist = 1 AND NOT ${visited}) OR jp.want_return = 1
     ORDER BY p.id`,
  );
  const candidates: TonightCandidate[] = [];
  for (const row of rows) {
    const venue = toVenue(row);
    if (!venue) continue;
    const onWishlist = row.wishlist === 1 && !row.is_visited;
    candidates.push({
      ...venue,
      status: row.is_visited ? 'visited' : onWishlist ? 'wishlist' : 'none',
      wantReturn: row.want_return === 1,
      reason: onWishlist ? 'wishlist' : 'goBack',
    });
  }
  return candidates;
}
