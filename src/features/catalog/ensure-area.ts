import type { SQLiteDatabase } from 'expo-sqlite';

import { getStaleTiles, replacePlacesInArea } from '@/data/places';
import { fetchVenues } from '@/features/catalog/overpass';
import { boundsOfTiles, tileKeysForBounds } from '@/features/catalog/tiles';

/** Degrees of latitude per meter (longitude is scaled by the latitude's cosine). */
const DEG_PER_M = 1 / 111_320;

/**
 * Makes sure the catalog tiles within `radiusM` of a point were fetched at least once (e.g. a
 * pasted link to a city the map never showed). Tiles already cached are not refreshed here.
 * Returns whether anything was fetched; throws `CatalogFetchError` if Overpass is unreachable.
 */
export async function ensureAreaLoaded(db: SQLiteDatabase, lat: number, lon: number, radiusM: number) {
  const dLat = radiusM * DEG_PER_M;
  const dLon = dLat / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const tiles = tileKeysForBounds({ south: lat - dLat, north: lat + dLat, west: lon - dLon, east: lon + dLon });
  // freshAfter 0: only tiles never fetched count as missing.
  const missing = await getStaleTiles(db, tiles, 0);
  if (missing.length === 0) return false;
  const area = boundsOfTiles(missing);
  const venues = await fetchVenues(area);
  await replacePlacesInArea(db, area, venues, missing, Date.now());
  return true;
}
