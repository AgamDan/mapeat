import type { SQLiteDatabase } from 'expo-sqlite';

import type { PersonId } from '@/data/people';
import { toVenue, type PlaceRow } from '@/data/places';
import type { Venue } from '@/features/catalog/types';
import type { LocalDate } from '@/lib/dates';

export type PersonTopPlace = {
  placeId: string;
  venue: Venue | null;
  /** That person's own average over their reviews of this place (never combined with the partner's). */
  average: number;
  reviews: number;
};

export type Disagreement = {
  visitId: string;
  placeId: string;
  venue: Venue | null;
  visitDate: LocalDate;
  ratings: Record<PersonId, number>;
  /** Absolute difference between the two ratings. */
  gap: number;
};

export type JournalStats = {
  year: number;
  /** Visits whose date falls in `year`. */
  visitsThisYear: number;
  /** Distinct places visited in `year`. */
  placesThisYear: number;
  /** Each person's own highest-rated places (all time), best first. */
  topByPerson: Record<PersonId, PersonTopPlace[]>;
  /** Visits where both reviewed and the ratings differ most (all time), biggest gap first. */
  disagreements: Disagreement[];
};

/** Small journal statistics for the Timeline header. `limit` caps each list. */
export async function getStats(db: SQLiteDatabase, year: number, limit = 3): Promise<JournalStats> {
  const yearPrefix = `${year}-%`;
  const counts = await db.getFirstAsync<{ visits: number; places: number }>(
    `SELECT COUNT(*) AS visits, COUNT(DISTINCT place_id) AS places FROM visits WHERE visit_date LIKE ?`,
    [yearPrefix],
  );

  const topByPerson: Record<PersonId, PersonTopPlace[]> = { a: [], b: [] };
  for (const person of ['a', 'b'] as const) {
    const rows = await db.getAllAsync<PlaceRow & { v_place_id: string; average: number; reviews: number }>(
      `SELECT p.*, v.place_id AS v_place_id, AVG(r.rating) AS average, COUNT(*) AS reviews
       FROM visit_reviews r JOIN visits v ON v.id = r.visit_id LEFT JOIN places p ON p.id = v.place_id
       WHERE r.author_id = ?
       GROUP BY v.place_id
       ORDER BY average DESC, reviews DESC, MAX(v.visit_date) DESC
       LIMIT ?`,
      [person, limit],
    );
    topByPerson[person] = rows.map((row) => ({
      placeId: row.v_place_id,
      venue: row.id ? toVenue(row) : null,
      average: row.average,
      reviews: row.reviews,
    }));
  }

  const gapRows = await db.getAllAsync<
    PlaceRow & { visit_id: string; v_place_id: string; visit_date: string; rating_a: number; rating_b: number }
  >(
    `SELECT p.*, v.id AS visit_id, v.place_id AS v_place_id, v.visit_date,
            ra.rating AS rating_a, rb.rating AS rating_b
     FROM visits v
     JOIN visit_reviews ra ON ra.visit_id = v.id AND ra.author_id = 'a'
     JOIN visit_reviews rb ON rb.visit_id = v.id AND rb.author_id = 'b'
     LEFT JOIN places p ON p.id = v.place_id
     WHERE ra.rating <> rb.rating
     ORDER BY ABS(ra.rating - rb.rating) DESC, v.visit_date DESC, v.id
     LIMIT ?`,
    [limit],
  );
  const disagreements = gapRows.map<Disagreement>((row) => ({
    visitId: row.visit_id,
    placeId: row.v_place_id,
    venue: row.id ? toVenue(row) : null,
    visitDate: row.visit_date,
    ratings: { a: row.rating_a, b: row.rating_b },
    gap: Math.abs(row.rating_a - row.rating_b),
  }));

  return {
    year,
    visitsThisYear: counts?.visits ?? 0,
    placesThisYear: counts?.places ?? 0,
    topByPerson,
    disagreements,
  };
}
