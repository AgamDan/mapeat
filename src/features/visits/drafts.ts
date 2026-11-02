import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { isPersonId, type PersonId } from '@/data/people';
import { isLocalDate, type LocalDate } from '@/lib/dates';

/** An unsaved visit or review, kept on the phone until it is saved or explicitly discarded. */
export type VisitDraft = {
  /** Stable for the whole life of the draft, so retries never create duplicates. */
  submissionId: string;
  visitDate: LocalDate;
  /** Who is typing ("Writing as"). */
  writer: PersonId;
  /** Whole number 1–10, or `null` until chosen (never 0). */
  rating: number | null;
  notes: string;
  /**
   * Review drafts only: the review's `updatedAt` this draft started from (`null` when adding).
   * Kept so a restored draft can't silently overwrite a newer version of the review.
   */
  baseUpdatedAt?: number | null;
};

const PREFIX = 'mapeat.draft.v1:';
const PERSIST_DELAY_MS = 400;

export function newVisitDraftKey(placeId: string) {
  return `${PREFIX}new:${placeId}`;
}

export function reviewDraftKey(visitId: string, author: PersonId) {
  return `${PREFIX}review:${visitId}:${author}`;
}

export function isValidRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

function parseDraft(raw: string | null): VisitDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<VisitDraft>;
    if (
      typeof value.submissionId !== 'string' ||
      !value.submissionId ||
      !isLocalDate(value.visitDate) ||
      !isPersonId(value.writer) ||
      typeof value.notes !== 'string' ||
      !(value.rating === null || isValidRating(value.rating))
    ) {
      return null;
    }
    const draft: VisitDraft = {
      submissionId: value.submissionId,
      visitDate: value.visitDate,
      writer: value.writer,
      rating: value.rating,
      notes: value.notes,
    };
    if (value.baseUpdatedAt !== undefined) {
      draft.baseUpdatedAt = typeof value.baseUpdatedAt === 'number' ? value.baseUpdatedAt : null;
    }
    return draft;
  } catch {
    return null;
  }
}

export async function loadDraft(key: string): Promise<VisitDraft | null> {
  return parseDraft(await AsyncStorage.getItem(key));
}

export async function saveDraft(key: string, draft: VisitDraft): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(draft));
}

export async function clearDraft(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

type Stored = { key: string; draft: VisitDraft | null };
type Edited = { key: string; draft: VisitDraft };

export type VisitDraftState = {
  /** `null` while the stored draft (or the screen's starting values) is still loading. */
  draft: VisitDraft | null;
  /** A draft from an earlier session was restored. */
  restored: boolean;
  /** The draft differs from the starting values, so it is kept on the phone. */
  dirty: boolean;
  update: (patch: Partial<VisitDraft>) => void;
  /** Forgets the draft (after a successful save or an explicit discard). */
  clear: () => Promise<void>;
};

/**
 * Loads the draft stored under `key` once; without one, starts from `initial` (which may arrive
 * later, e.g. after the visit loads). Nothing is persisted until the user changes something; after
 * that every change is written (debounced, flushed on unmount and when the app leaves the foreground).
 */
export function useVisitDraft(key: string, initial: VisitDraft | null): VisitDraftState {
  const [stored, setStored] = useState<Stored | null>(null);
  const [edited, setEdited] = useState<Edited | null>(null);
  const pending = useRef<Edited | null>(null);
  const writing = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    loadDraft(key)
      .catch(() => null)
      .then((draft) => {
        if (!cancelled) setStored({ key, draft });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const flush = useCallback(() => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    // A failed write only risks the draft on an app restart; the open form keeps everything.
    writing.current = writing.current.then(() => saveDraft(next.key, next.draft)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!edited) return;
    pending.current = edited;
    const timer = setTimeout(flush, PERSIST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [edited, flush]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') flush();
    });
    return () => {
      subscription.remove();
      flush();
    };
  }, [flush]);

  const loaded = stored?.key === key;
  const restoredDraft = loaded ? stored.draft : null;
  const editedDraft = edited?.key === key ? edited.draft : null;
  const draft = editedDraft ?? restoredDraft ?? (loaded ? initial : null);

  const update = useCallback(
    (patch: Partial<VisitDraft>) => {
      setEdited((current) => {
        const base = current?.key === key ? current.draft : draft;
        return base ? { key, draft: { ...base, ...patch } } : current;
      });
    },
    [key, draft],
  );

  const clear = useCallback(async () => {
    pending.current = null;
    setEdited(null);
    setStored({ key, draft: null });
    await writing.current;
    await clearDraft(key);
  }, [key]);

  return {
    draft,
    restored: restoredDraft !== null,
    dirty: editedDraft !== null || restoredDraft !== null,
    update,
    clear,
  };
}
