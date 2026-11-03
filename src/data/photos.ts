import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyJournalChanged } from '@/data/journal-events';
import { isPersonId, type PersonId } from '@/data/people';
import { JournalValidationError, VisitNotFoundError } from '@/data/visits';
import { writeTransaction } from '@/data/write-queue';
import { deletePhotoFiles } from '@/features/photos/photo-files';

/** Most photos a single visit can hold (decided with the user). */
export const MAX_PHOTOS_PER_VISIT = 10;

export type PhotoKind = 'visit' | 'menu';

export type Photo = {
  id: string;
  kind: PhotoKind;
  placeId: string;
  /** Set for visit photos, `null` for menu photos. */
  visitId: string | null;
  addedBy: PersonId;
  /** Stored file name; display with `photoUri(fileName)`. */
  fileName: string;
  width: number;
  height: number;
  /** When the picture was taken (from EXIF), else `null`; fall back to `createdAt`. */
  takenAt: number | null;
  createdAt: number;
};

export type NewPhotoInput = {
  /** Stable per picked image; adding the same submission twice keeps one row. */
  submissionId: string;
  id: string;
  kind: PhotoKind;
  placeId: string;
  visitId: string | null;
  addedBy: PersonId;
  fileName: string;
  width: number;
  height: number;
  takenAt: number | null;
};

export class PhotoLimitError extends Error {}

type PhotoRow = {
  id: string;
  kind: string;
  place_id: string;
  visit_id: string | null;
  added_by: string;
  file_name: string;
  width: number;
  height: number;
  taken_at: number | null;
  created_at: number;
};

function toPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    kind: row.kind === 'menu' ? 'menu' : 'visit',
    placeId: row.place_id,
    visitId: row.visit_id,
    addedBy: isPersonId(row.added_by) ? row.added_by : 'a',
    fileName: row.file_name,
    width: row.width,
    height: row.height,
    takenAt: row.taken_at,
    createdAt: row.created_at,
  };
}

/**
 * Records a stored photo file. Visit photos need an existing visit of that place and respect
 * `MAX_PHOTOS_PER_VISIT` (throws `PhotoLimitError`). Menu photos may be added before any visit.
 * Never throws once the row is saved, so callers may safely delete the file on any error.
 */
export async function addPhoto(db: SQLiteDatabase, input: NewPhotoInput): Promise<Photo> {
  if ((input.kind === 'visit') !== (input.visitId !== null)) {
    throw new JournalValidationError('Visit photos need a visit; menu photos must not have one');
  }
  let saved: Photo | null = null;
  await writeTransaction(db, async (txn) => {
    const existing = await txn.getFirstAsync<PhotoRow>('SELECT * FROM photos WHERE submission_id = ?', [
      input.submissionId,
    ]);
    if (existing) {
      saved = toPhoto(existing);
      return;
    }
    if (input.visitId) {
      const visit = await txn.getFirstAsync<{ place_id: string }>('SELECT place_id FROM visits WHERE id = ?', [
        input.visitId,
      ]);
      if (!visit || visit.place_id !== input.placeId) throw new VisitNotFoundError(input.visitId);
      const count = await txn.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM photos WHERE visit_id = ?', [
        input.visitId,
      ]);
      if ((count?.n ?? 0) >= MAX_PHOTOS_PER_VISIT) throw new PhotoLimitError(input.visitId);
    }
    const now = Date.now();
    await txn.runAsync(
      `INSERT INTO journal_places (place_id, wishlist, want_return, created_at, updated_at)
       VALUES (?, 0, 0, ?, ?) ON CONFLICT (place_id) DO NOTHING`,
      [input.placeId, now, now],
    );
    await txn.runAsync(
      `INSERT INTO photos (id, kind, place_id, visit_id, added_by, file_name, width, height, taken_at, submission_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id, input.kind, input.placeId, input.visitId, input.addedBy, input.fileName,
        input.width, input.height, input.takenAt, input.submissionId, now,
      ],
    );
    saved = {
      id: input.id,
      kind: input.kind,
      placeId: input.placeId,
      visitId: input.visitId,
      addedBy: input.addedBy,
      fileName: input.fileName,
      width: input.width,
      height: input.height,
      takenAt: input.takenAt,
      createdAt: now,
    };
  });
  try {
    notifyJournalChanged();
  } catch {
    // A listener failing must not turn a saved photo into a reported failure.
  }
  return saved!;
}

export async function getPhoto(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<PhotoRow>('SELECT * FROM photos WHERE id = ?', [id]);
  return row ? toPhoto(row) : null;
}

/** A visit's photos in the order they were added. */
export async function getVisitPhotos(db: SQLiteDatabase, visitId: string) {
  const rows = await db.getAllAsync<PhotoRow>('SELECT * FROM photos WHERE visit_id = ? ORDER BY created_at, id', [
    visitId,
  ]);
  return rows.map(toPhoto);
}

/** Photos for many visits at once (e.g. timeline thumbnails), keyed by visit id. */
export async function getPhotosForVisits(db: SQLiteDatabase, visitIds: readonly string[]) {
  const result = new Map<string, Photo[]>();
  for (let start = 0; start < visitIds.length; start += 500) {
    const chunk = visitIds.slice(start, start + 500);
    const rows = await db.getAllAsync<PhotoRow>(
      `SELECT * FROM photos WHERE visit_id IN (${chunk.map(() => '?').join(', ')}) ORDER BY created_at, id`,
      [...chunk],
    );
    for (const row of rows) {
      const list = result.get(row.visit_id!) ?? [];
      list.push(toPhoto(row));
      result.set(row.visit_id!, list);
    }
  }
  return result;
}

/** A place's menu photos, newest (by date taken, else added) first. */
export async function getMenuPhotos(db: SQLiteDatabase, placeId: string) {
  const rows = await db.getAllAsync<PhotoRow>(
    `SELECT * FROM photos WHERE place_id = ? AND kind = 'menu'
     ORDER BY COALESCE(taken_at, created_at) DESC, created_at DESC, id`,
    [placeId],
  );
  return rows.map(toPhoto);
}

/** Deletes one photo (and its file). If it was the place's cover, the cover is cleared. */
export async function deletePhoto(db: SQLiteDatabase, id: string) {
  let fileName: string | null = null;
  await writeTransaction(db, async (txn) => {
    const row = await txn.getFirstAsync<{ file_name: string; place_id: string }>(
      'SELECT file_name, place_id FROM photos WHERE id = ?',
      [id],
    );
    if (!row) return;
    fileName = row.file_name;
    await txn.runAsync('DELETE FROM photos WHERE id = ?', [id]);
    await txn.runAsync('UPDATE journal_places SET cover_photo_id = NULL WHERE cover_photo_id = ?', [id]);
  });
  if (fileName) deletePhotoFiles([fileName]);
  notifyJournalChanged();
}

/**
 * Chooses one of the place's own visit photos as its private journal cover (`null` clears it).
 * Covers are never shown as public profile photos.
 */
export async function setCoverPhoto(db: SQLiteDatabase, placeId: string, photoId: string | null) {
  await writeTransaction(db, async (txn) => {
    if (photoId) {
      const photo = await txn.getFirstAsync<{ place_id: string; kind: string }>(
        'SELECT place_id, kind FROM photos WHERE id = ?',
        [photoId],
      );
      if (!photo || photo.place_id !== placeId || photo.kind !== 'visit') {
        throw new JournalValidationError('A cover must be one of this place’s visit photos');
      }
    }
    // updated_at is left alone: it orders the "want to go back" list, which a cover must not reorder.
    await txn.runAsync('UPDATE journal_places SET cover_photo_id = ? WHERE place_id = ?', [photoId, placeId]);
  });
  notifyJournalChanged();
}

/** The place's private cover photo, if one was chosen. */
export async function getCoverPhoto(db: SQLiteDatabase, placeId: string) {
  const row = await db.getFirstAsync<PhotoRow>(
    `SELECT p.* FROM journal_places jp JOIN photos p ON p.id = jp.cover_photo_id WHERE jp.place_id = ?`,
    [placeId],
  );
  return row ? toPhoto(row) : null;
}

/** Covers for many places at once (e.g. wishlist rows), keyed by place id. */
export async function getCoverPhotos(db: SQLiteDatabase, placeIds: readonly string[]) {
  const result = new Map<string, Photo>();
  for (let start = 0; start < placeIds.length; start += 500) {
    const chunk = placeIds.slice(start, start + 500);
    const rows = await db.getAllAsync<PhotoRow & { cover_place_id: string }>(
      `SELECT p.*, jp.place_id AS cover_place_id FROM journal_places jp JOIN photos p ON p.id = jp.cover_photo_id
       WHERE jp.place_id IN (${chunk.map(() => '?').join(', ')})`,
      [...chunk],
    );
    for (const row of rows) result.set(row.cover_place_id, toPhoto(row));
  }
  return result;
}

/** Every stored file name (for deleting orphaned files at startup). */
export async function getAllPhotoFileNames(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ file_name: string }>('SELECT file_name FROM photos');
  return new Set(rows.map((row) => row.file_name));
}

/**
 * The couple's photo to show at the top of a place page when it has no public photo: the chosen
 * cover, otherwise the newest visit photo, otherwise the newest menu photo.
 */
export async function getHeaderPhoto(db: SQLiteDatabase, placeId: string) {
  const cover = await getCoverPhoto(db, placeId);
  if (cover) return cover;
  const row = await db.getFirstAsync<PhotoRow>(
    `SELECT * FROM photos WHERE place_id = ?
     ORDER BY kind = 'visit' DESC, COALESCE(taken_at, created_at) DESC, created_at DESC, id
     LIMIT 1`,
    [placeId],
  );
  return row ? toPhoto(row) : null;
}

/**
 * The photo file to draw on each place's map pin, keyed by place id: the chosen main photo
 * (cover), otherwise the newest visit photo. Menu photos are never used. Places without one are
 * left out. Every photo's place has a `journal_places` row (foreign key), so that table is the start.
 */
export async function getMapPhotoFiles(db: SQLiteDatabase, placeIds: readonly string[]) {
  const result = new Map<string, string>();
  for (let start = 0; start < placeIds.length; start += 500) {
    const chunk = placeIds.slice(start, start + 500);
    const marks = chunk.map(() => '?').join(', ');
    const rows = await db.getAllAsync<{ place_id: string; file_name: string | null }>(
      `SELECT jp.place_id AS place_id, COALESCE(
         (SELECT c.file_name FROM photos c WHERE c.id = jp.cover_photo_id),
         (SELECT n.file_name FROM photos n WHERE n.place_id = jp.place_id AND n.kind = 'visit'
          ORDER BY COALESCE(n.taken_at, n.created_at) DESC, n.created_at DESC, n.id LIMIT 1)
       ) AS file_name
       FROM journal_places jp WHERE jp.place_id IN (${marks})`,
      [...chunk],
    );
    for (const row of rows) if (row.file_name) result.set(row.place_id, row.file_name);
  }
  return result;
}