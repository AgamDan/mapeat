import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { useJournalRevision } from '@/data/journal-events';
import { DEFAULT_PEOPLE, getPeople, type Person, type PersonId } from '@/data/people';

/** The two journal members, refreshed after renames. */
export function usePeople() {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    let cancelled = false;
    getPeople(db)
      // If the names can't be read, show the default names rather than spinning forever.
      .then((result) => (result.length > 0 ? result : [...DEFAULT_PEOPLE]))
      .catch(() => [...DEFAULT_PEOPLE])
      .then((result) => {
        if (!cancelled) setPeople(result);
      });
    return () => {
      cancelled = true;
    };
  }, [db, revision]);

  const byId = (id: PersonId) => people.find((person) => person.id === id) ?? null;
  return { people, byId, ready: people.length > 0 };
}
