import type { SQLiteDatabase } from 'expo-sqlite';

import { writeTransaction } from '@/data/write-queue';

import { tileKeyOf } from '@/features/catalog/tiles';

/** Row layout written by scripts/build-catalog.mjs (see its FIELDS list). */
type StarterRow = [
  id: string,
  kind: string,
  name: string | null,
  nameHe: string | null,
  nameEn: string | null,
  lat: number,
  lon: number,
  cuisine: string | null,
  street: string | null,
  housenumber: string | null,
  city: string | null,
  website: string | null,
  openingHours: string | null,
  wikimediaCommons: string | null,
];

type StarterCatalog = { version: string; places: StarterRow[] };

const VERSION_KEY = 'starter_catalog_version';
const ROWS_PER_STATEMENT = 200;
const COLUMNS =
  'id, osm_type, osm_id, kind, name, name_he, name_en, lat, lon, cuisine, street, housenumber, city, website, opening_hours, wikimedia_commons, fetched_at';
const UPDATABLE = COLUMNS.split(', ')
  .filter((column) => column !== 'id')
  .map((column) => `${column} = excluded.${column}`)
  .join(', ');

/**
 * Loads the built-in Israel catalog into the places cache once per catalog version.
 * Rows never overwrite fresher data fetched live from Overpass.
 */
export async function seedStarterCatalog(db: SQLiteDatabase) {
  // Required lazily: the ~1 MB JSON is only evaluated when seeding is actually needed.
  const catalog = require('@/assets/catalog/israel.json') as StarterCatalog;
  const current = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM catalog_meta WHERE key = ?',
    [VERSION_KEY],
  );
  if (current?.value === catalog.version) return;

  const fetchedAt = Date.parse(catalog.version);
  const tileKeys = new Set<string>();

  await writeTransaction(db, async (txn) => {
    for (let start = 0; start < catalog.places.length; start += ROWS_PER_STATEMENT) {
      const rows = catalog.places.slice(start, start + ROWS_PER_STATEMENT);
      const params: (string | number | null)[] = [];
      for (const [id, kind, name, nameHe, nameEn, lat, lon, ...rest] of rows) {
        params.push(id, id.startsWith('w') ? 'way' : 'node', Number(id.slice(1)), kind, name, nameHe, nameEn, lat, lon, ...rest, fetchedAt);
        tileKeys.add(tileKeyOf(lat, lon));
      }
      const placeholders = rows.map(() => `(${new Array(17).fill('?').join(', ')})`).join(', ');
      await txn.runAsync(
        `INSERT INTO places (${COLUMNS}) VALUES ${placeholders}
         ON CONFLICT (id) DO UPDATE SET ${UPDATABLE} WHERE excluded.fetched_at > places.fetched_at`,
        params,
      );
    }
    // Also mark neighboring tiles (~2 km): empty ground or sea next to venues is covered by this
    // catalog too, so the app doesn't ask Overpass about it.
    const covered = new Set<string>();
    for (const key of tileKeys) {
      const [y, x] = key.split(':').map(Number);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) covered.add(`${y + dy}:${x + dx}`);
      }
    }
    const coveredKeys = [...covered];
    for (let start = 0; start < coveredKeys.length; start += ROWS_PER_STATEMENT) {
      const keys = coveredKeys.slice(start, start + ROWS_PER_STATEMENT);
      await txn.runAsync(
        `INSERT INTO catalog_tiles (tile_key, fetched_at) VALUES ${keys.map(() => '(?, ?)').join(', ')}
         ON CONFLICT (tile_key) DO UPDATE SET fetched_at = excluded.fetched_at
         WHERE excluded.fetched_at > catalog_tiles.fetched_at`,
        keys.flatMap((key) => [key, fetchedAt]),
      );
    }
    await txn.runAsync(
      'INSERT INTO catalog_meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [VERSION_KEY, catalog.version],
    );
  });
}
