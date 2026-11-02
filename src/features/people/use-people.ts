import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { useJournalRevision } from '@/data/journal-events';
import { getPeople, type Person, type PersonId } from '@/data/people';

/** The two journal members, refreshed after renames. */
export function usePeople() {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    let cancelled = false;
    getPeople(db)
      .catch(() => [])
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
