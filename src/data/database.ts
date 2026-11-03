import type { SQLiteDatabase } from 'expo-sqlite';

import { ensurePeople } from '@/data/people';
import { getAllPhotoFileNames } from '@/data/photos';
import { seedStarterCatalog } from '@/data/starter-catalog';
import { writeTransaction } from '@/data/write-queue';
import { deleteOrphanPhotoFiles } from '@/features/photos/photo-files';

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
  `
  CREATE TABLE people (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );
  CREATE TABLE journal_places (
    place_id TEXT PRIMARY KEY NOT NULL,
    wishlist INTEGER NOT NULL DEFAULT 0,
    want_return INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE visits (
    id TEXT PRIMARY KEY NOT NULL,
    place_id TEXT NOT NULL REFERENCES journal_places (place_id),
    visit_date TEXT NOT NULL CHECK (visit_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    submission_id TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL REFERENCES people (id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX visits_place ON visits (place_id, visit_date DESC);
  CREATE INDEX visits_timeline ON visits (visit_date DESC, created_at DESC, id);
  CREATE TABLE visit_reviews (
    id TEXT PRIMARY KEY NOT NULL,
    visit_id TEXT NOT NULL REFERENCES visits (id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES people (id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
    notes TEXT,
    submission_id TEXT NOT NULL UNIQUE,
    last_editor_id TEXT NOT NULL REFERENCES people (id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (visit_id, author_id)
  );
  `,
  `
  ALTER TABLE journal_places ADD COLUMN wishlist_added_at INTEGER;
  UPDATE journal_places SET wishlist_added_at = updated_at WHERE wishlist = 1;
  CREATE INDEX journal_places_wishlist ON journal_places (wishlist, wishlist_added_at DESC);
  CREATE TABLE tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE place_tags (
    place_id TEXT NOT NULL REFERENCES journal_places (place_id),
    tag_id TEXT NOT NULL REFERENCES tags (id),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (place_id, tag_id)
  );
  CREATE INDEX place_tags_tag ON place_tags (tag_id);
  `,
  `
  CREATE TABLE photos (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('visit', 'menu')),
    place_id TEXT NOT NULL REFERENCES journal_places (place_id),
    visit_id TEXT REFERENCES visits (id),
    added_by TEXT NOT NULL REFERENCES people (id),
    file_name TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    taken_at INTEGER,
    submission_id TEXT NOT NULL UNIQUE,
    upload_state TEXT NOT NULL DEFAULT 'local',
    created_at INTEGER NOT NULL,
    CHECK ((kind = 'visit') = (visit_id IS NOT NULL))
  );
  CREATE INDEX photos_visit ON photos (visit_id, created_at);
  CREATE INDEX photos_place_kind ON photos (place_id, kind, created_at DESC);
  ALTER TABLE journal_places ADD COLUMN cover_photo_id TEXT;
  `,
];

/** Opens the app database: runs migrations, then loads the built-in catalog if it changed. */
export async function initDatabase(db: SQLiteDatabase) {
  await migrateDatabase(db);
  await ensurePeople(db);
  try {
    await seedStarterCatalog(db);
  } catch (error) {
    // The app still works without the built-in catalog (live Overpass + cache), so don't block launch.
    console.warn('Built-in catalog could not be loaded', error);
  }
  try {
    // Files left by an add that was interrupted before its database row was saved.
    deleteOrphanPhotoFiles(await getAllPhotoFileNames(db));
  } catch (error) {
    console.warn('Photo cleanup skipped', error);
  }
}

export async function migrateDatabase(db: SQLiteDatabase) {
  // busy_timeout lets main-connection writes wait for a transaction connection instead of failing.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    await writeTransaction(db, async (txn) => {
      await txn.execAsync(MIGRATIONS[version]);
      await txn.execAsync(`PRAGMA user_version = ${version + 1};`);
    });
  }
}
