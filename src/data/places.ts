import type { SQLiteDatabase } from 'expo-sqlite';

import { isVenueKind, type Bounds, type Venue } from '@/features/catalog/types';

type PlaceRow = {
  id: string;
  osm_type: string;
  osm_id: number;
  kind: string;
  name: string | null;
  name_he: string | null;
  name_en: string | null;
  lat: number;
  lon: number;
  cuisine: string | null;
  street: string | null;
  housenumber: string | null;
  city: string | null;
  website: string | null;
  opening_hours: string | null;
  wikimedia_commons: string | null;
  fetched_at: number;
};

function toVenue(row: PlaceRow): Venue | null {
  if (!isVenueKind(row.kind)) return null;
  const osmType = row.osm_type === 'way' || row.osm_type === 'relation' ? row.osm_type : 'node';
  return {
    id: row.id,
    osmType,
    osmId: row.osm_id,
    kind: row.kind,
    name: row.name,
    nameHe: row.name_he,
    nameEn: row.name_en,
    lat: row.lat,
    lon: row.lon,
    cuisine: row.cuisine,
    street: row.street,
    housenumber: row.housenumber,
    city: row.city,
    website: row.website,
    openingHours: row.opening_hours,
    wikimediaCommons: row.wikimedia_commons,
    fetchedAt: row.fetched_at,
  };
}

function compact(rows: PlaceRow[]) {
  return rows.map(toVenue).filter((venue): venue is Venue => venue !== null);
}

/** Cached places inside `bounds`, nearest to the center first, at most `limit`. */
export async function getPlacesInBounds(db: SQLiteDatabase, bounds: Bounds, limit: number) {
  const centerLat = (bounds.south + bounds.north) / 2;
  const centerLon = (bounds.west + bounds.east) / 2;
  const rows = await db.getAllAsync<PlaceRow>(
    `SELECT * FROM places
     WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
     ORDER BY (lat - ?) * (lat - ?) + (lon - ?) * (lon - ?)
     LIMIT ?`,
    [bounds.south, bounds.north, bounds.west, bounds.east, centerLat, centerLat, centerLon, centerLon, limit],
  );
  return compact(rows);
}

export async function getPlace(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<PlaceRow>('SELECT * FROM places WHERE id = ?', [id]);
  return row ? toVenue(row) : null;
}

/**
 * Replace the cached places of a freshly fetched area: upsert the new results, then drop
 * places in that area that OpenStreetMap no longer returns (closed or retagged venues).
 */
export async function replacePlacesInArea(
  db: SQLiteDatabase,
  area: Bounds,
  venues: Venue[],
  tileKeys: string[],
  fetchedAt: number,
) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const insert = await txn.prepareAsync(
      `INSERT OR REPLACE INTO places
       (id, osm_type, osm_id, kind, name, name_he, name_en, lat, lon, cuisine, street, housenumber,
        city, website, opening_hours, wikimedia_commons, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    try {
      for (const v of venues) {
        await insert.executeAsync([
          v.id, v.osmType, v.osmId, v.kind, v.name, v.nameHe, v.nameEn, v.lat, v.lon, v.cuisine,
          v.street, v.housenumber, v.city, v.website, v.openingHours, v.wikimediaCommons, fetchedAt,
        ]);
      }
    } finally {
      await insert.finalizeAsync();
    }
    // Places in the journal (visited or wishlisted) are kept even if OpenStreetMap drops them.
    await txn.runAsync(
      `DELETE FROM places
       WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? AND fetched_at < ?
         AND id NOT IN (SELECT place_id FROM journal_places)`,
      [area.south, area.north, area.west, area.east, fetchedAt],
    );
    for (const key of tileKeys) {
      await txn.runAsync('INSERT OR REPLACE INTO catalog_tiles (tile_key, fetched_at) VALUES (?, ?)', [
        key,
        fetchedAt,
      ]);
    }
  });
}

/** Which of `tileKeys` were never fetched or were fetched before `freshAfter`. */
export async function getStaleTiles(db: SQLiteDatabase, tileKeys: string[], freshAfter: number) {
  if (tileKeys.length === 0) return [];
  const placeholders = tileKeys.map(() => '?').join(', ');
  const fresh = await db.getAllAsync<{ tile_key: string }>(
    `SELECT tile_key FROM catalog_tiles WHERE tile_key IN (${placeholders}) AND fetched_at >= ?`,
    [...tileKeys, freshAfter],
  );
  const freshKeys = new Set(fresh.map((row) => row.tile_key));
  return tileKeys.filter((key) => !freshKeys.has(key));
}
