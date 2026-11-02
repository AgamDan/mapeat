import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyJournalChanged } from '@/data/journal-events';
import { enqueueWrite } from '@/data/write-queue';
import { isPersonId, type PersonId } from '@/data/people';
import { isLocalDate, type LocalDate } from '@/lib/dates';
import { newId } from '@/lib/ids';

export type VisitReview = {
  id: string;
  visitId: string;
  authorId: PersonId;
  /** Whole number 1–10. A missing review is absent, never 0. */
  rating: number;
  notes: string | null;
  lastEditorId: PersonId;
  createdAt: number;
  updatedAt: number;
};

export type Visit = {
  id: string;
  placeId: string;
  visitDate: LocalDate;
  createdBy: PersonId;
  createdAt: number;
  updatedAt: number;
  /** At most one review per person. */
  reviews: Partial<Record<PersonId, VisitReview>>;
};

export type JournalPlace = {
  placeId: string;
  wishlist: boolean;
  wantReturn: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PlaceJournal = {
  journalPlace: JournalPlace | null;
  /** Newest visit date first; same-day visits newest-created first. */
  visits: Visit[];
  /** Each person's own average over this place's visits; `null` if they never reviewed it. */
  averages: Record<PersonId, number | null>;
};

export type NewVisitInput = {
  /** Stable id kept with the draft; retrying the same submission never creates a second visit. */
  submissionId: string;
  placeId: string;
  visitDate: LocalDate;
  authorId: PersonId;
  rating: number;
  notes: string | null;
};

export type ReviewInput = {
  /** Used only when this creates the review; edits are naturally idempotent. */
  submissionId: string;
  visitId: string;
  authorId: PersonId;
  /** Who is making this change ("Writing as"); either person may edit either review. */
  editorId: PersonId;
  rating: number;
  notes: string | null;
  /** `updatedAt` the editor started from, or `null` when adding. A mismatch throws `ReviewConflictError`. */
  expectedUpdatedAt: number | null;
};

export class JournalValidationError extends Error {}
export class ReviewConflictError extends Error {}
export class VisitNotFoundError extends Error {}

function validateRating(rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    throw new JournalValidationError(`Rating must be a whole number 1–10, got ${rating}`);
  }
}

function validateDate(visitDate: string) {
  if (!isLocalDate(visitDate)) throw new JournalValidationError(`Invalid visit date ${visitDate}`);
}

function cleanNotes(notes: string | null) {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : null;
}

type ReviewRow = {
  id: string;
  visit_id: string;
  author_id: string;
  rating: number;
  notes: string | null;
  last_editor_id: string;
  created_at: number;
  updated_at: number;
};

type VisitRow = {
  id: string;
  place_id: string;
  visit_date: string;
  created_by: string;
  created_at: number;
  updated_at: number;
};

function toReview(row: ReviewRow): VisitReview | null {
  if (!isPersonId(row.author_id)) return null;
  return {
    id: row.id,
    visitId: row.visit_id,
    authorId: row.author_id,
    rating: row.rating,
    notes: row.notes,
    lastEditorId: isPersonId(row.last_editor_id) ? row.last_editor_id : row.author_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toVisits(visitRows: VisitRow[], reviewRows: ReviewRow[]): Visit[] {
  const visits = visitRows.map<Visit>((row) => ({
    id: row.id,
    placeId: row.place_id,
    visitDate: row.visit_date,
    createdBy: isPersonId(row.created_by) ? row.created_by : 'a',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviews: {},
  }));
  const byId = new Map(visits.map((visit) => [visit.id, visit]));
  for (const row of reviewRows) {
    const review = toReview(row);
    const visit = byId.get(row.visit_id);
    if (review && visit) visit.reviews[review.authorId] = review;
  }
  return visits;
}

/**
 * Saves a new visit with its first review in one transaction. Creates the journal place if
 * needed and, for the place's first visit, takes it off the wishlist.
 */
export async function saveNewVisit(db: SQLiteDatabase, input: NewVisitInput): Promise<{ visitId: string }> {
  validateDate(input.visitDate);
  validateRating(input.rating);
  let visitId = '';
  await enqueueWrite(() => db.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<{ id: string }>(
      'SELECT id FROM visits WHERE submission_id = ?',
      [input.submissionId],
    );
    if (existing) {
      visitId = existing.id;
      return;
    }
    const now = Date.now();
    visitId = newId();
    await txn.runAsync(
      `INSERT INTO journal_places (place_id, wishlist, want_return, created_at, updated_at)
       VALUES (?, 0, 0, ?, ?) ON CONFLICT (place_id) DO NOTHING`,
      [input.placeId, now, now],
    );
    const earlier = await txn.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM visits WHERE place_id = ?',
      [input.placeId],
    );
    if ((earlier?.n ?? 0) === 0) {
      await txn.runAsync(
        'UPDATE journal_places SET wishlist = 0, updated_at = ? WHERE place_id = ? AND wishlist = 1',
        [now, input.placeId],
      );
    }
    await txn.runAsync(
      `INSERT INTO visits (id, place_id, visit_date, submission_id, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [visitId, input.placeId, input.visitDate, input.submissionId, input.authorId, now, now],
    );
    await txn.runAsync(
      `INSERT INTO visit_reviews
       (id, visit_id, author_id, rating, notes, submission_id, last_editor_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), visitId, input.authorId, input.rating, cleanNotes(input.notes), input.submissionId, input.authorId, now, now],
    );
  }));
  notifyJournalChanged();
  return { visitId };
}

/** Adds `authorId`'s review to an existing visit, or edits it if it already exists. */
export async function saveReview(db: SQLiteDatabase, input: ReviewInput): Promise<void> {
  validateRating(input.rating);
  await enqueueWrite(() => db.withExclusiveTransactionAsync(async (txn) => {
    const visit = await txn.getFirstAsync<{ id: string }>('SELECT id FROM visits WHERE id = ?', [input.visitId]);
    if (!visit) throw new VisitNotFoundError(input.visitId);
    const resubmitted = await txn.getFirstAsync<{ id: string }>(
      'SELECT id FROM visit_reviews WHERE submission_id = ?',
      [input.submissionId],
    );
    if (resubmitted && input.expectedUpdatedAt === null) return;

    const current = await txn.getFirstAsync<{ id: string; updated_at: number }>(
      'SELECT id, updated_at FROM visit_reviews WHERE visit_id = ? AND author_id = ?',
      [input.visitId, input.authorId],
    );
    const now = Date.now();
    if (current) {
      if (current.updated_at !== input.expectedUpdatedAt) {
        throw new ReviewConflictError(current.id);
      }
      await txn.runAsync(
        `UPDATE visit_reviews SET rating = ?, notes = ?, last_editor_id = ?, updated_at = ? WHERE id = ?`,
        [input.rating, cleanNotes(input.notes), input.editorId, Math.max(now, current.updated_at + 1), current.id],
      );
    } else {
      if (input.expectedUpdatedAt !== null) throw new ReviewConflictError(input.visitId);
      await txn.runAsync(
        `INSERT INTO visit_reviews
         (id, visit_id, author_id, rating, notes, submission_id, last_editor_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), input.visitId, input.authorId, input.rating, cleanNotes(input.notes), input.submissionId, input.editorId, now, now],
      );
    }
    await txn.runAsync('UPDATE visits SET updated_at = ? WHERE id = ?', [now, input.visitId]);
  }));
  notifyJournalChanged();
}

export async function updateVisitDate(db: SQLiteDatabase, visitId: string, visitDate: LocalDate) {
  validateDate(visitDate);
  const result = await enqueueWrite(() =>
    db.runAsync('UPDATE visits SET visit_date = ?, updated_at = ? WHERE id = ?', [visitDate, Date.now(), visitId]),
  );
  if (result.changes === 0) throw new VisitNotFoundError(visitId);
  notifyJournalChanged();
}

/** Deletes a visit and its reviews. The journal place (and its wishlist state) stays. */
export async function deleteVisit(db: SQLiteDatabase, visitId: string) {
  await enqueueWrite(() => db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM visit_reviews WHERE visit_id = ?', [visitId]);
    await txn.runAsync('DELETE FROM visits WHERE id = ?', [visitId]);
  }));
  notifyJournalChanged();
}

/** Deletes one review; if it was the visit's only review, the visit is deleted too. */
export async function deleteReview(db: SQLiteDatabase, reviewId: string): Promise<{ visitDeleted: boolean }> {
  let visitDeleted = false;
  await enqueueWrite(() => db.withExclusiveTransactionAsync(async (txn) => {
    const review = await txn.getFirstAsync<{ visit_id: string }>(
      'SELECT visit_id FROM visit_reviews WHERE id = ?',
      [reviewId],
    );
    if (!review) return;
    await txn.runAsync('DELETE FROM visit_reviews WHERE id = ?', [reviewId]);
    const left = await txn.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM visit_reviews WHERE visit_id = ?',
      [review.visit_id],
    );
    if ((left?.n ?? 0) === 0) {
      await txn.runAsync('DELETE FROM visits WHERE id = ?', [review.visit_id]);
      visitDeleted = true;
    }
  }));
  notifyJournalChanged();
  return { visitDeleted };
}

export async function getVisit(db: SQLiteDatabase, visitId: string): Promise<Visit | null> {
  const visitRows = await db.getAllAsync<VisitRow>('SELECT * FROM visits WHERE id = ?', [visitId]);
  if (visitRows.length === 0) return null;
  const reviewRows = await db.getAllAsync<ReviewRow>('SELECT * FROM visit_reviews WHERE visit_id = ?', [visitId]);
  return toVisits(visitRows, reviewRows)[0];
}

export async function getPlaceJournal(db: SQLiteDatabase, placeId: string): Promise<PlaceJournal> {
  const place = await db.getFirstAsync<{
    place_id: string;
    wishlist: number;
    want_return: number;
    created_at: number;
    updated_at: number;
  }>('SELECT * FROM journal_places WHERE place_id = ?', [placeId]);
  const visitRows = await db.getAllAsync<VisitRow>(
    'SELECT * FROM visits WHERE place_id = ? ORDER BY visit_date DESC, created_at DESC, id',
    [placeId],
  );
  const reviewRows = await db.getAllAsync<ReviewRow>(
    `SELECT r.* FROM visit_reviews r JOIN visits v ON v.id = r.visit_id WHERE v.place_id = ?`,
    [placeId],
  );
  const visits = toVisits(visitRows, reviewRows);
  const average = (person: PersonId) => {
    const ratings = visits.flatMap((visit) => visit.reviews[person]?.rating ?? []);
    return ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;
  };
  return {
    journalPlace: place
      ? {
          placeId: place.place_id,
          wishlist: place.wishlist === 1,
          wantReturn: place.want_return === 1,
          createdAt: place.created_at,
          updatedAt: place.updated_at,
        }
      : null,
    visits,
    averages: { a: average('a'), b: average('b') },
  };
}
