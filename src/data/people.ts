import type { SQLiteDatabase } from 'expo-sqlite';

import type { ThemeColor } from '@/constants/theme';
import { notifyJournalChanged } from '@/data/journal-events';
import { enqueueWrite } from '@/data/write-queue';

/** The two journal members. Local ids `a` / `b` map to real accounts when the backend arrives. */
export type PersonId = 'a' | 'b';
export type Person = { id: PersonId; name: string; color: Extract<ThemeColor, 'personA' | 'personB'> };

/** Starting names chosen by the couple; renamable in Settings. */
export const DEFAULT_PEOPLE: readonly Person[] = [
  { id: 'a', name: 'Artur', color: 'personA' },
  { id: 'b', name: 'Agam', color: 'personB' },
];

export function isPersonId(value: unknown): value is PersonId {
  return value === 'a' || value === 'b';
}

export async function ensurePeople(db: SQLiteDatabase) {
  await enqueueWrite(async () => {
    for (const [index, person] of DEFAULT_PEOPLE.entries()) {
      await db.runAsync(
        'INSERT OR IGNORE INTO people (id, name, color, sort_order) VALUES (?, ?, ?, ?)',
        [person.id, person.name, person.color, index],
      );
    }
  });
}

export async function getPeople(db: SQLiteDatabase): Promise<Person[]> {
  const rows = await db.getAllAsync<{ id: string; name: string; color: string }>(
    'SELECT id, name, color FROM people ORDER BY sort_order',
  );
  return rows
    .filter((row) => isPersonId(row.id))
    .map((row) => ({
      id: row.id as PersonId,
      name: row.name,
      color: row.color === 'personB' ? 'personB' : 'personA',
    }));
}

export async function renamePerson(db: SQLiteDatabase, id: PersonId, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await enqueueWrite(() => db.runAsync('UPDATE people SET name = ? WHERE id = ?', [trimmed, id]));
  notifyJournalChanged();
}
