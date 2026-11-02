import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { isPersonId } from '@/data/people';
import { getPlace } from '@/data/places';
import { getVisit, ReviewConflictError, saveReview, VisitNotFoundError, type Visit } from '@/data/visits';
import { venueNames } from '@/features/catalog/labels';
import type { Venue } from '@/features/catalog/types';
import { usePeople } from '@/features/people/use-people';
import { reviewDraftKey, useVisitDraft, type VisitDraft } from '@/features/visits/drafts';
import { closeVisitForm, VisitForm, type ValidVisitDraft } from '@/features/visits/visit-form';
import { useTheme } from '@/hooks/use-theme';
import type { TranslationKey } from '@/i18n/en';
import { useLanguage, useT } from '@/i18n/i18n';
import { formatVisitDate } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { useSettings } from '@/settings/settings-provider';

type Loaded = { visitId: string; visit: Visit | null; venue: Venue | null };

/** Adds or edits one person's review (`author`) on an existing visit (`id`). */
export default function ReviewScreen() {
  const { id: visitId = '', author: authorParam } = useLocalSearchParams<{ id: string; author: string }>();
  const author = isPersonId(authorParam) ? authorParam : null;
  const db = useSQLiteContext();
  const t = useT();
  const theme = useTheme();
  const { language } = useLanguage();
  const { writer, setWriter } = useSettings();
  const { byId } = usePeople();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // Fixed for this screen, so the starting draft stays the same while the visit loads.
  const [submissionId] = useState(newId);
  const [startWriter] = useState(writer);

  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;
    getVisit(db, visitId)
      .then(async (visit) => ({
        visit,
        venue: visit ? await getPlace(db, visit.placeId).catch(() => null) : null,
      }))
      .catch(() => ({ visit: null, venue: null }))
      .then((result) => {
        if (!cancelled) setLoaded({ visitId, ...result });
      });
    return () => {
      cancelled = true;
    };
  }, [db, visitId]);

  // `undefined` while loading, `null` when the visit doesn't exist.
  const visit = !visitId || !author ? null : loaded?.visitId === visitId ? loaded.visit : undefined;
  const review = author && visit ? visit.reviews[author] : undefined;
  const initial: VisitDraft | null = visit
    ? {
        submissionId,
        visitDate: visit.visitDate,
        writer: startWriter,
        rating: review?.rating ?? null,
        notes: review?.notes ?? '',
        baseUpdatedAt: review?.updatedAt ?? null,
      }
    : null;
  const { draft, restored, dirty, update, clear } = useVisitDraft(
    reviewDraftKey(visitId, author ?? 'a'),
    initial,
  );

  if (visit === null || !author) {
    return (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary">{t('visit.notFound')}</ThemedText>
      </View>
    );
  }

  if (visit === undefined || draft === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const authorPerson = byId(author);
  const authorName = authorPerson?.name ?? '';
  const authorColor = authorPerson ? theme[authorPerson.color] : theme.accent;
  const lastEditor = review && review.lastEditorId !== review.authorId ? byId(review.lastEditorId) : null;
  const placeName = loaded?.venue ? venueNames(loaded.venue, language).primary : null;

  async function submit(valid: ValidVisitDraft): Promise<TranslationKey | null> {
    if (!author) return 'visit.notFound';
    try {
      await saveReview(db, {
        submissionId: valid.submissionId,
        visitId,
        authorId: author,
        editorId: valid.writer,
        rating: valid.rating,
        notes: valid.notes,
        expectedUpdatedAt: valid.baseUpdatedAt ?? null,
      });
    } catch (error) {
      if (error instanceof ReviewConflictError) return 'visit.conflict';
      if (error instanceof VisitNotFoundError) return 'visit.notFound';
      return 'visit.saveFailed';
    }
    // Saved. A draft left behind by a failed removal can't overwrite anything: a re-add is
    // ignored by its submission id and a re-edit conflicts on `updatedAt`.
    await clear().catch(() => {});
    setWriter(valid.writer);
    closeVisitForm();
    return null;
  }

  async function discard() {
    await clear();
    closeVisitForm();
  }

  return (
    <VisitForm
      header={
        <View style={styles.header}>
          <ThemedText type="subtitle">{placeName ?? t('place.unnamed')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatVisitDate(visit.visitDate, language)}
          </ThemedText>
          <ThemedText type="title" style={{ color: authorColor }}>
            {draft.baseUpdatedAt == null ? t('visit.addReviewFor', { name: authorName }) : authorName}
          </ThemedText>
          {lastEditor ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('visit.editedBy', { name: lastEditor.name })}
            </ThemedText>
          ) : null}
        </View>
      }
      draft={draft}
      onChange={update}
      showDate={false}
      ratingColor={authorColor}
      restored={restored}
      canDiscard={dirty}
      onDiscard={discard}
      onSubmit={submit}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  header: {
    gap: Spacing.half,
  },
});
