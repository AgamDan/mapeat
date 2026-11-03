import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyJournalChanged } from '@/data/journal-events';
import { isPersonId, type PersonId } from '@/data/people';
import { toVenue, type PlaceRow } from '@/data/places';
import { JournalValidationError, type Visit, type VisitReview } from '@/data/visits';
import { writeTransaction } from '@/data/write-queue';
import { VENUE_KINDS, type Bounds, type Venue, type VenueKind } from '@/features/catalog/types';
import type { LocalDate } from '@/lib/dates';
import { newId } from '@/lib/ids';

/* ------------------------------------------------------------------ wishlist / want to go back */

/** Puts a place on the shared wishlist (or takes it off). Either person may do both. */
export async function setWishlist(db: SQLiteDatabase, placeId: string, on: boolean) {
  const now = Date.now();
  await writeTransaction(db, async (txn) => {
    await ensureJournalPlace(txn, placeId, now);
    await txn.runAsync(
      `UPDATE journal_places
       SET wishlist = ?, wishlist_added_at = CASE WHEN ? = 1 THEN COALESCE(wishlist_added_at, ?) ELSE NULL END,
           updated_at = ?
       WHERE place_id = ?`,
      [on ? 1 : 0, on ? 1 : 0, now, now, placeId],
    );
  });
  notifyJournalChanged();
}

/** Marks a place "want to go back" (or clears it). Saving a new visit clears it automatically. */
export async function setWantReturn(db: SQLiteDatabase, placeId: string, on: boolean) {
  const now = Date.now();
  await writeTransaction(db, async (txn) => {
    await ensureJournalPlace(txn, placeId, now);
    await txn.runAsync('UPDATE journal_places SET want_return = ?, updated_at = ? WHERE place_id = ?', [
      on ? 1 : 0,
      now,
      placeId,
    ]);
  });
  notifyJournalChanged();
}

async function ensureJournalPlace(txn: SQLiteDatabase, placeId: string, now: number) {
  await txn.runAsync(
    `INSERT INTO journal_places (place_id, wishlist, want_return, created_at, updated_at)
     VALUES (?, 0, 0, ?, ?) ON CONFLICT (place_id) DO NOTHING`,
    [placeId, now, now],
  );
}

export type ListedPlace = {
  placeId: string;
  /** `null` if the place is no longer in the phone's catalog (should not happen for journal places). */
  venue: Venue | null;
  /** When it was put on the wishlist, or last marked "want to go back". */
  addedAt: number;
  visitCount: number;
  lastVisitDate: LocalDate | null;
  tags: Tag[];
};

type ListedRow = PlaceRow & {
  jp_place_id: string;
  added_at: number;
  visit_count: number;
  last_visit_date: string | null;
};

async function listPlaces(db: SQLiteDatabase, where: string, orderBy: string): Promise<ListedPlace[]> {
  const rows = await db.getAllAsync<ListedRow>(
    `SELECT p.*, jp.place_id AS jp_place_id, ${orderBy} AS added_at,
            (SELECT COUNT(*) FROM visits v WHERE v.place_id = jp.place_id) AS visit_count,
            (SELECT MAX(v.visit_date) FROM visits v WHERE v.place_id = jp.place_id) AS last_visit_date
     FROM journal_places jp LEFT JOIN places p ON p.id = jp.place_id
     WHERE ${where}
     ORDER BY added_at DESC, jp.place_id`,
  );
  const tagsByPlace = await getTagsForPlaces(db, rows.map((row) => row.jp_place_id));
  return rows.map((row) => ({
    placeId: row.jp_place_id,
    venue: row.id ? toVenue(row) : null,
    addedAt: row.added_at,
    visitCount: row.visit_count,
    lastVisitDate: row.last_visit_date,
    tags: tagsByPlace.get(row.jp_place_id) ?? [],
  }));
}

/** Places on the wishlist, most recently added first. */
export function getWishlist(db: SQLiteDatabase) {
  return listPlaces(db, 'jp.wishlist = 1', 'COALESCE(jp.wishlist_added_at, jp.updated_at)');
}

/** Places marked "want to go back", most recently marked first. */
export function getWantReturnPlaces(db: SQLiteDatabase) {
  return listPlaces(db, 'jp.want_return = 1', 'jp.updated_at');
}

/* ----------------------------------------------------------------------------------- tags */

export type Tag = { id: string; name: string };

const MAX_TAG_LENGTH = 30;

function cleanTagName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > MAX_TAG_LENGTH) {
    throw new JournalValidationError(`Tag name must be 1–${MAX_TAG_LENGTH} characters`);
  }
  return trimmed;
}

export class DuplicateTagError extends Error {}

/** All tags, alphabetical. */
export function listTags(db: SQLiteDatabase) {
  return db.getAllAsync<Tag>('SELECT id, name FROM tags ORDER BY name COLLATE NOCASE, id');
}

/** Creates a tag, or returns the existing one with the same name (case-insensitive). */
export async function createTag(db: SQLiteDatabase, name: string): Promise<Tag> {
  const clean = cleanTagName(name);
  let tag: Tag | null = null;
  await writeTransaction(db, async (txn) => {
    tag = await txn.getFirstAsync<Tag>('SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE', [clean]);
    if (tag) return;
    tag = { id: newId(), name: clean };
    await txn.runAsync('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)', [tag.id, tag.name, Date.now()]);
  });
  notifyJournalChanged();
  return tag!;
}

/** Renames a tag everywhere. Throws `DuplicateTagError` if another tag already has that name. */
export async function renameTag(db: SQLiteDatabase, id: string, name: string) {
  const clean = cleanTagName(name);
  await writeTransaction(db, async (txn) => {
    const other = await txn.getFirstAsync<{ id: string }>(
      'SELECT id FROM tags WHERE name = ? COLLATE NOCASE AND id <> ?',
      [clean, id],
    );
    if (other) throw new DuplicateTagError(clean);
    await txn.runAsync('UPDATE tags SET name = ? WHERE id = ?', [clean, id]);
  });
  notifyJournalChanged();
}

/** Deletes a tag and removes it from every place. */
export async function deleteTag(db: SQLiteDatabase, id: string) {
  await writeTransaction(db, async (txn) => {
    await txn.runAsync('DELETE FROM place_tags WHERE tag_id = ?', [id]);
    await txn.runAsync('DELETE FROM tags WHERE id = ?', [id]);
  });
  notifyJournalChanged();
}

export async function getPlaceTags(db: SQLiteDatabase, placeId: string) {
  return (await getTagsForPlaces(db, [placeId])).get(placeId) ?? [];
}

/** Replaces a place's tags with exactly `tagIds` (unknown ids are ignored). */
export async function setPlaceTags(db: SQLiteDatabase, placeId: string, tagIds: readonly string[]) {
  const now = Date.now();
  await writeTransaction(db, async (txn) => {
    await ensureJournalPlace(txn, placeId, now);
    await txn.runAsync('DELETE FROM place_tags WHERE place_id = ?', [placeId]);
    for (const tagId of new Set(tagIds)) {
      await txn.runAsync(
        `INSERT INTO place_tags (place_id, tag_id, created_at)
         SELECT ?, id, ? FROM tags WHERE id = ?`,
        [placeId, now, tagId],
      );
    }
  });
  notifyJournalChanged();
}

async function getTagsForPlaces(db: SQLiteDatabase, placeIds: readonly string[]) {
  const result = new Map<string, Tag[]>();
  // Chunked to stay well under SQLite's bound-parameter limit.
  for (let start = 0; start < placeIds.length; start += 500) {
    const chunk = placeIds.slice(start, start + 500);
    const rows = await db.getAllAsync<{ place_id: string; id: string; name: string }>(
      `SELECT pt.place_id, t.id, t.name FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
       WHERE pt.place_id IN (${chunk.map(() => '?').join(', ')})
       ORDER BY t.name COLLATE NOCASE, t.id`,
      chunk,
    );
    for (const row of rows) {
      const list = result.get(row.place_id) ?? [];
      list.push({ id: row.id, name: row.name });
      result.set(row.place_id, list);
    }
  }
  return result;
}

/* ------------------------------------------------------------------------------- timeline */

export type TimelineVisit = Visit & { venue: Venue | null };

/** Keyset cursor: the last visit of the previous page. */
export type TimelineCursor = { visitDate: LocalDate; createdAt: number; id: string };

export type TimelinePage = { items: TimelineVisit[]; nextCursor: TimelineCursor | null };

/**
 * Visits newest first (visit date, then creation time, then id — stable for same-day visits).
 * `person` keeps only visits that person has reviewed.
 */
export async function getTimeline(
  db: SQLiteDatabase,
  options: { person?: PersonId | null; limit?: number; cursor?: TimelineCursor | null } = {},
): Promise<TimelinePage> {
  const limit = options.limit ?? 30;
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (options.person) {
    where.push('EXISTS (SELECT 1 FROM visit_reviews r WHERE r.visit_id = v.id AND r.author_id = ?)');
    params.push(options.person);
  }
  if (options.cursor) {
    const c = options.cursor;
    where.push('(v.visit_date < ? OR (v.visit_date = ? AND (v.created_at < ? OR (v.created_at = ? AND v.id > ?))))');
    params.push(c.visitDate, c.visitDate, c.createdAt, c.createdAt, c.id);
  }
  const visitRows = await db.getAllAsync<
    PlaceRow & { v_id: string; v_place_id: string; visit_date: string; created_by: string; v_created_at: number; v_updated_at: number }
  >(
    `SELECT p.*, v.id AS v_id, v.place_id AS v_place_id, v.visit_date, v.created_by,
            v.created_at AS v_created_at, v.updated_at AS v_updated_at
     FROM visits v LEFT JOIN places p ON p.id = v.place_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY v.visit_date DESC, v.created_at DESC, v.id
     LIMIT ?`,
    [...params, limit + 1],
  );
  const page = visitRows.slice(0, limit);
  const reviews = await getReviewsForVisits(db, page.map((row) => row.v_id));
  const items = page.map<TimelineVisit>((row) => ({
    id: row.v_id,
    placeId: row.v_place_id,
    visitDate: row.visit_date,
    createdBy: isPersonId(row.created_by) ? row.created_by : 'a',
    createdAt: row.v_created_at,
    updatedAt: row.v_updated_at,
    reviews: reviews.get(row.v_id) ?? {},
    venue: row.id ? toVenue(row) : null,
  }));
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      visitRows.length > limit && last ? { visitDate: last.visitDate, createdAt: last.createdAt, id: last.id } : null,
  };
}

async function getReviewsForVisits(db: SQLiteDatabase, visitIds: readonly string[]) {
  const result = new Map<string, Partial<Record<PersonId, VisitReview>>>();
  if (visitIds.length === 0) return result;
  const rows = await db.getAllAsync<{
    id: string;
    visit_id: string;
    author_id: string;
    rating: number;
    notes: string | null;
    last_editor_id: string;
    created_at: number;
    updated_at: number;
  }>(`SELECT * FROM visit_reviews WHERE visit_id IN (${visitIds.map(() => '?').join(', ')})`, [...visitIds]);
  for (const row of rows) {
    if (!isPersonId(row.author_id)) continue;
    const reviews = result.get(row.visit_id) ?? {};
    reviews[row.author_id] = {
      id: row.id,
      visitId: row.visit_id,
      authorId: row.author_id,
      rating: row.rating,
      notes: row.notes,
      lastEditorId: isPersonId(row.last_editor_id) ? row.last_editor_id : row.author_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    result.set(row.visit_id, reviews);
  }
  return result;
}

/* ------------------------------------------------------------------------------ map places */

/** What a map pin represents in our journal. */
export type JournalStatus = 'visited' | 'wishlist' | 'none';

export type MapPlace = Venue & { status: JournalStatus; wantReturn: boolean };

export type MapShow = 'all' | 'journal' | 'visited' | 'wishlist';

export type MapFilter = {
  show: MapShow;
  /** Empty = every venue kind. */
  kinds: readonly VenueKind[];
  /** OSM cuisine value (lowercase, e.g. `pizza`), or `null` for any. */
  cuisine: string | null;
  /** Empty = no tag filter; otherwise the place must have at least one of these tags. */
  tagIds: readonly string[];
};

export const DEFAULT_MAP_FILTER: MapFilter = { show: 'all', kinds: [], cuisine: null, tagIds: [] };

/**
 * Places inside `bounds` that match `filter`, nearest to the center first, with their journal
 * status. Visited wins over wishlist when both are set.
 */
export async function getMapPlaces(db: SQLiteDatabase, bounds: Bounds, filter: MapFilter, limit: number) {
  const centerLat = (bounds.south + bounds.north) / 2;
  const centerLon = (bounds.west + bounds.east) / 2;
  const where = ['p.lat BETWEEN ? AND ?', 'p.lon BETWEEN ? AND ?'];
  const params: (string | number)[] = [bounds.south, bounds.north, bounds.west, bounds.east];

  const kinds = filter.kinds.filter((kind) => VENUE_KINDS.includes(kind));
  if (kinds.length > 0 && kinds.length < VENUE_KINDS.length) {
    where.push(`p.kind IN (${kinds.map(() => '?').join(', ')})`);
    params.push(...kinds);
  }
  if (filter.cuisine) {
    where.push(`(';' || REPLACE(LOWER(COALESCE(p.cuisine, '')), ' ', '') || ';') LIKE ?`);
    params.push(`%;${filter.cuisine.toLowerCase().replace(/\s+/g, '')};%`);
  }
  if (filter.tagIds.length > 0) {
    where.push(
      `EXISTS (SELECT 1 FROM place_tags pt WHERE pt.place_id = p.id AND pt.tag_id IN (${filter.tagIds.map(() => '?').join(', ')}))`,
    );
    params.push(...filter.tagIds);
  }
  const visited = 'EXISTS (SELECT 1 FROM visits v WHERE v.place_id = p.id)';
  if (filter.show === 'journal') where.push(`(${visited} OR jp.wishlist = 1 OR jp.want_return = 1)`);
  if (filter.show === 'visited') where.push(visited);
  if (filter.show === 'wishlist') where.push(`jp.wishlist = 1 AND NOT ${visited}`);

  const rows = await db.getAllAsync<PlaceRow & { is_visited: number; wishlist: number | null; want_return: number | null }>(
    `SELECT p.*, ${visited} AS is_visited, jp.wishlist, jp.want_return
     FROM places p LEFT JOIN journal_places jp ON jp.place_id = p.id
     WHERE ${where.join(' AND ')}
     ORDER BY (p.lat - ?) * (p.lat - ?) + (p.lon - ?) * (p.lon - ?)
     LIMIT ?`,
    [...params, centerLat, centerLat, centerLon, centerLon, limit],
  );
  const places: MapPlace[] = [];
  for (const row of rows) {
    const venue = toVenue(row);
    if (!venue) continue;
    places.push({
      ...venue,
      status: row.is_visited ? 'visited' : row.wishlist === 1 ? 'wishlist' : 'none',
      wantReturn: row.want_return === 1,
    });
  }
  return places;
}

/** Every journal place (visited, wishlist, or "want to go back") with coordinates, for zoomed-out maps. */
export async function getAllJournalMapPlaces(db: SQLiteDatabase, filter: MapFilter, limit: number) {
  const world: Bounds = { south: -90, north: 90, west: -180, east: 180 };
  return getMapPlaces(db, world, { ...filter, show: filter.show === 'all' ? 'journal' : filter.show }, limit);
}
