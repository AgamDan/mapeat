import type { SQLiteDatabase } from 'expo-sqlite';

import { seedStarterCatalog } from '@/data/starter-catalog';

export const DATABASE_NAME = 'mapeat.db';

/**
 * Ordered schema migrations. Never edit a shipped migration; append a new one.
 * `PRAGMA user_version` records how many have run.
 */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE places (
    id TEXT PRIMARY KEY NOT NULL,
    osm_type TEXT NOT NULL,
    osm_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    name TEXT,
    name_he TEXT,
    name_en TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    cuisine TEXT,
    street TEXT,
    housenumber TEXT,
    city TEXT,
    website TEXT,
    opening_hours TEXT,
    wikimedia_commons TEXT,
    fetched_at INTEGER NOT NULL
  );
  CREATE INDEX places_lat_lon ON places (lat, lon);
  CREATE TABLE catalog_tiles (
    tile_key TEXT PRIMARY KEY NOT NULL,
    fetched_at INTEGER NOT NULL
  );
  `,
  `
  CREATE TABLE catalog_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

/** Opens the app database: runs migrations, then loads the built-in catalog if it changed. */
export async function initDatabase(db: SQLiteDatabase) {
  await migrateDatabase(db);
  try {
    await seedStarterCatalog(db);
  } catch (error) {
    // The app still works without the built-in catalog (live Overpass + cache), so don't block launch.
    console.warn('Built-in catalog could not be loaded', error);
  }
}

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[version]);
      await txn.execAsync(`PRAGMA user_version = ${version + 1};`);
    });
  }
}
