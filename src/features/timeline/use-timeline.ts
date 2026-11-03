import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getTimeline, type TimelineCursor, type TimelineVisit } from '@/data/journal';
import { useJournalRevision } from '@/data/journal-events';
import type { PersonId } from '@/data/people';

const PAGE_SIZE = 20;

type State = {
  /** Filter the items belong to; a different filter never shows stale items. */
  person: PersonId | null;
  items: TimelineVisit[];
  nextCursor: TimelineCursor | null;
  /** The first page (or a reload) failed. Items from an earlier load may still be shown. */
  error: boolean;
  /** An older page failed; the loaded items stay visible. */
  moreError: boolean;
  loadingMore: boolean;
};

/**
 * Timeline visits newest first, paged by keyset cursor. Any journal write, filter change or retry
 * reloads from the first page; a request generation drops pages that arrive from an older load,
 * so a reload can never duplicate or mix items.
 */
export function useTimeline(person: PersonId | null) {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State | null>(null);
  const generation = useRef(0);
  const loadingMore = useRef(false);

  useEffect(() => {
    const requestGeneration = ++generation.current;
    loadingMore.current = false;
    getTimeline(db, { person, limit: PAGE_SIZE }).then(
      (page) => {
        if (generation.current !== requestGeneration) return;
        setState({
          person,
          items: page.items,
          nextCursor: page.nextCursor,
          error: false,
          moreError: false,
          loadingMore: false,
        });
      },
      () => {
        if (generation.current !== requestGeneration) return;
        setState((previous) =>
          previous?.person === person
            ? { ...previous, error: true, loadingMore: false }
            : { person, items: [], nextCursor: null, error: true, moreError: false, loadingMore: false },
        );
      },
    );
  }, [db, person, revision, attempt]);

  const current = state && state.person === person ? state : null;
  const cursor = current?.nextCursor ?? null;

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore.current) return;
    const requestGeneration = generation.current;
    loadingMore.current = true;
    setState((previous) => (previous ? { ...previous, loadingMore: true, moreError: false } : previous));
    getTimeline(db, { person, limit: PAGE_SIZE, cursor }).then(
      (page) => {
        if (generation.current !== requestGeneration) return;
        loadingMore.current = false;
        setState((previous) => {
          if (!previous) return previous;
          const seen = new Set(previous.items.map((item) => item.id));
          return {
            ...previous,
            items: [...previous.items, ...page.items.filter((item) => !seen.has(item.id))],
            nextCursor: page.nextCursor,
            loadingMore: false,
          };
        });
      },
      () => {
        if (generation.current !== requestGeneration) return;
        loadingMore.current = false;
        setState((previous) => (previous ? { ...previous, loadingMore: false, moreError: true } : previous));
      },
    );
  }, [db, person, cursor]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    items: current?.items ?? [],
    loading: current === null,
    error: current?.error ?? false,
    hasMore: cursor !== null,
    loadingMore: current?.loadingMore ?? false,
    moreError: current?.moreError ?? false,
    loadMore,
    retry,
  };
}
