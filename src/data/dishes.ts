import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyJournalChanged } from '@/data/journal-events';
import { isPersonId, type PersonId } from '@/data/people';
import { JournalValidationError, VisitNotFoundError } from '@/data/visits';
import { writeTransaction } from '@/data/write-queue';
import type { LocalDate } from '@/lib/dates';

/** Longest dish name accepted (after trimming). */
export const MAX_DISH_NAME_LENGTH = 80;

export type DishVote = 1 | -1;

/** One dish on a visit's shared "what we ordered" list. */
export type Dish = {
  id: string;
  visitId: string;
  name: string;
  addedBy: PersonId;
  createdAt: number;
  updatedAt: number;
  /** Each person's own 👍 (1) or 👎 (-1); a missing key means that person has not voted. */
  votes: Partial<Record<PersonId, DishVote>>;
};

export type NewDishInput = {
  /** Stable per add attempt; adding the same submission twice keeps one dish. */
  submissionId: string;
  id: string;
  visitId: string;
  name: string;
  addedBy: PersonId;
};

export type DishVerdict = 'orderAgain' | 'skip' | 'mixed' | 'none';

/** One dish name as ordered across all of a place's visits. */
export type PlaceDishSummary = {
  /** Spelling used the most recent time it was ordered. */
  name: string;
  timesOrdered: number;
  /** Visit date of the most recent time it was ordered. */
  lastVisitDate: LocalDate;
  /** Every vote each person ever gave this dish here (all visits). */
  votes: Record<PersonId, { up: number; down: number }>;
  /** Each person's vote from the newest visit on which they voted for this dish. */
  latest: Partial<Record<PersonId, DishVote>>;
  verdict: DishVerdict;
};

export class DishNotFoundError extends Error {}

/**
 * Trims, collapses inner whitespace, and validates a dish name.
 * Throws `JournalValidationError` when empty or longer than `MAX_DISH_NAME_LENGTH`.
 */
export function cleanDishName(name: string) {
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned) throw new JournalValidationError('A dish needs a name');
  if (cleaned.length > MAX_DISH_NAME_LENGTH) {
    throw new JournalValidationError(`Dish name is longer than ${MAX_DISH_NAME_LENGTH} characters`);
  }
  return cleaned;
}

/** Key used to treat two dish names as the same dish: cleaned and lower-cased. */
export function dishNameKey(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

type DishRow = {
  id: string;
  visit_id: string;
  name: string;
  added_by: string;
  created_at: number;
  updated_at: number;
};

type VoteRow = { dish_id: string; person_id: string; vote: number };

function toVote(value: number): DishVote | null {
  return value === 1 ? 1 : value === -1 ? -1 : null;
}

function toDishes(rows: DishRow[], votes: VoteRow[]): Dish[] {
  const dishes = rows.map<Dish>((row) => ({
    id: row.id,
    visitId: row.visit_id,
    name: row.name,
    addedBy: isPersonId(row.added_by) ? row.added_by : 'a',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    votes: {},
  }));
  const byId = new Map(dishes.map((dish) => [dish.id, dish]));
  for (const row of votes) {
    const dish = byId.get(row.dish_id);
    const vote = toVote(row.vote);
    if (dish && vote && isPersonId(row.person_id)) dish.votes[row.person_id] = vote;
  }
  return dishes;
}

/** A visit's dishes in the order they were added. */
export async function getVisitDishes(db: SQLiteDatabase, visitId: string): Promise<Dish[]> {
  const rows = await db.getAllAsync<DishRow>(
    'SELECT * FROM dishes WHERE visit_id = ? ORDER BY created_at, id',
    [visitId],
  );
  if (rows.length === 0) return [];
  const votes = await db.getAllAsync<VoteRow>(
    `SELECT v.dish_id, v.person_id, v.vote FROM dish_votes v JOIN dishes d ON d.id = v.dish_id
     WHERE d.visit_id = ?`,
    [visitId],
  );
  return toDishes(rows, votes);
}

/**
 * Adds a dish to an existing visit (`VisitNotFoundError` otherwise). The name is cleaned with
 * `cleanDishName`. Idempotent: a repeated `submissionId` returns the dish saved the first time.
 * `createdAt` is kept strictly increasing within a visit so the list order is stable.
 */
export async function addDish(db: SQLiteDatabase, input: NewDishInput): Promise<Dish> {
  const name = cleanDishName(input.name);
  let saved: Dish | null = null;
  await writeTransaction(db, async (txn) => {
    const existing = await txn.getFirstAsync<DishRow>('SELECT * FROM dishes WHERE submission_id = ?', [
      input.submissionId,
    ]);
    if (existing) {
      const votes = await txn.getAllAsync<VoteRow>(
        'SELECT dish_id, person_id, vote FROM dish_votes WHERE dish_id = ?',
        [existing.id],
      );
      saved = toDishes([existing], votes)[0];
      return;
    }
    const visit = await txn.getFirstAsync<{ id: string }>('SELECT id FROM visits WHERE id = ?', [input.visitId]);
    if (!visit) throw new VisitNotFoundError(input.visitId);
    const last = await txn.getFirstAsync<{ t: number | null }>(
      'SELECT MAX(created_at) AS t FROM dishes WHERE visit_id = ?',
      [input.visitId],
    );
    const now = Math.max(Date.now(), (last?.t ?? 0) + 1);
    await txn.runAsync(
      `INSERT INTO dishes (id, visit_id, name, submission_id, added_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.id, input.visitId, name, input.submissionId, input.addedBy, now, now],
    );
    saved = {
      id: input.id,
      visitId: input.visitId,
      name,
      addedBy: input.addedBy,
      createdAt: now,
      updatedAt: now,
      votes: {},
    };
  });
  notifyJournalChanged();
  return saved!;
}

/** Renames a dish (name cleaned with `cleanDishName`). Throws `DishNotFoundError` if it is gone. */
export async function renameDish(db: SQLiteDatabase, id: string, name: string) {
  const cleaned = cleanDishName(name);
  await writeTransaction(db, async (txn) => {
    const dish = await txn.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM dishes WHERE id = ?', [id]);
    if (!dish) throw new DishNotFoundError(id);
    await txn.runAsync('UPDATE dishes SET name = ?, updated_at = ? WHERE id = ?', [
      cleaned,
      Math.max(Date.now(), dish.updated_at + 1),
      id,
    ]);
  });
  notifyJournalChanged();
}

/**
 * Deletes a dish and its votes. The votes are deleted explicitly because foreign keys are not
 * enforced inside transactions. Deleting a missing dish is a no-op.
 */
export async function deleteDish(db: SQLiteDatabase, id: string) {
  await writeTransaction(db, async (txn) => {
    await txn.runAsync('DELETE FROM dish_votes WHERE dish_id = ?', [id]);
    await txn.runAsync('DELETE FROM dishes WHERE id = ?', [id]);
  });
  notifyJournalChanged();
}

/**
 * Sets `personId`'s own vote on a dish: 1 (👍), -1 (👎), or `null` to remove it (no vote).
 * Throws `DishNotFoundError` if the dish is gone.
 */
export async function setDishVote(db: SQLiteDatabase, dishId: string, personId: PersonId, vote: DishVote | null) {
  if (vote !== null && vote !== 1 && vote !== -1) throw new JournalValidationError(`Invalid vote ${vote}`);
  await writeTransaction(db, async (txn) => {
    const dish = await txn.getFirstAsync<{ id: string }>('SELECT id FROM dishes WHERE id = ?', [dishId]);
    if (!dish) throw new DishNotFoundError(dishId);
    if (vote === null) {
      await txn.runAsync('DELETE FROM dish_votes WHERE dish_id = ? AND person_id = ?', [dishId, personId]);
    } else {
      await txn.runAsync(
        `INSERT INTO dish_votes (dish_id, person_id, vote, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (dish_id, person_id) DO UPDATE SET vote = excluded.vote, updated_at = excluded.updated_at`,
        [dishId, personId, vote, Date.now()],
      );
    }
  });
  notifyJournalChanged();
}

const VERDICT_ORDER: Record<DishVerdict, number> = { orderAgain: 0, mixed: 1, none: 2, skip: 3 };

/**
 * Summarizes a place's dishes across all its visits, so the couple knows what to order or avoid.
 *
 * Rules:
 * - Dishes are grouped by `dishNameKey` (trimmed, inner whitespace collapsed, lower-cased).
 * - "Newest" order is visit date desc, then visit created desc, then dish created desc.
 * - `name` is the spelling of the newest dish in the group; `lastVisitDate` its visit date.
 * - `timesOrdered` counts the group's dish rows (each time it was put on a visit's list).
 * - `votes` counts every 👍/👎 per person across all visits.
 * - `latest`: for each person, their vote from the newest dish in the group they voted on
 *   (an older vote is replaced by a newer one; a newer visit without their vote doesn't erase it).
 * - `verdict` uses only `latest` votes of both people: 👍 and no 👎 → `orderAgain`;
 *   👎 and no 👍 → `skip`; both → `mixed`; no votes → `none`.
 * - Sorted by verdict (orderAgain, mixed, none, skip), then `timesOrdered` desc, then newest
 *   `lastVisitDate` first, then name.
 */
export async function getPlaceDishSummary(db: SQLiteDatabase, placeId: string): Promise<PlaceDishSummary[]> {
  const rows = await db.getAllAsync<DishRow & { visit_date: string }>(
    `SELECT d.*, v.visit_date FROM dishes d JOIN visits v ON v.id = d.visit_id
     WHERE v.place_id = ?
     ORDER BY v.visit_date DESC, v.created_at DESC, d.created_at DESC, d.id`,
    [placeId],
  );
  if (rows.length === 0) return [];
  const voteRows = await db.getAllAsync<VoteRow>(
    `SELECT dv.dish_id, dv.person_id, dv.vote FROM dish_votes dv
     JOIN dishes d ON d.id = dv.dish_id JOIN visits v ON v.id = d.visit_id
     WHERE v.place_id = ?`,
    [placeId],
  );
  const dishes = toDishes(rows, voteRows);

  const groups = new Map<string, PlaceDishSummary>();
  dishes.forEach((dish, index) => {
    const key = dishNameKey(dish.name);
    let group = groups.get(key);
    if (!group) {
      // Rows are newest first, so the first dish of a group gives its name and date.
      group = {
        name: dish.name,
        timesOrdered: 0,
        lastVisitDate: rows[index].visit_date,
        votes: { a: { up: 0, down: 0 }, b: { up: 0, down: 0 } },
        latest: {},
        verdict: 'none',
      };
      groups.set(key, group);
    }
    group.timesOrdered++;
    for (const person of ['a', 'b'] as const) {
      const vote = dish.votes[person];
      if (!vote) continue;
      if (vote === 1) group.votes[person].up++;
      else group.votes[person].down++;
      if (group.latest[person] === undefined) group.latest[person] = vote;
    }
  });

  const summaries = [...groups.values()];
  for (const summary of summaries) {
    const latest = Object.values(summary.latest);
    const up = latest.includes(1);
    const down = latest.includes(-1);
    summary.verdict = up && down ? 'mixed' : up ? 'orderAgain' : down ? 'skip' : 'none';
  }
  return summaries.sort(
    (x, y) =>
      VERDICT_ORDER[x.verdict] - VERDICT_ORDER[y.verdict] ||
      y.timesOrdered - x.timesOrdered ||
      (x.lastVisitDate < y.lastVisitDate ? 1 : x.lastVisitDate > y.lastVisitDate ? -1 : 0) ||
      x.name.localeCompare(y.name),
  );
}
