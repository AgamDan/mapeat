import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getPlace } from '@/data/places';
import { saveNewVisit } from '@/data/visits';
import { venueNames } from '@/features/catalog/labels';
import type { Venue } from '@/features/catalog/types';
import { usePeople } from '@/features/people/use-people';
import { newVisitDraftKey, useVisitDraft, type VisitDraft } from '@/features/visits/drafts';
import { useCloseVisitForm, VisitForm, type ValidVisitDraft } from '@/features/visits/visit-form';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';
import { todayLocalDate } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { useSettings } from '@/settings/settings-provider';

export default function NewVisitScreen() {
  const { placeId = '' } = useLocalSearchParams<{ placeId: string }>();
  const db = useSQLiteContext();
  const closeForm = useCloseVisitForm();
  const t = useT();
  const theme = useTheme();
  const { language } = useLanguage();
  const { writer, setWriter } = useSettings();
  const { byId } = usePeople();
  const [loaded, setLoaded] = useState<{ placeId: string; venue: Venue | null } | null>(null);
  const [initial] = useState<VisitDraft>(() => ({
    submissionId: newId(),
    visitDate: todayLocalDate(),
    writer,
    rating: null,
    notes: '',
  }));
  const { draft, restored, dirty, update, clear } = useVisitDraft(newVisitDraftKey(placeId), initial);

  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    getPlace(db, placeId)
      .catch(() => null)
      .then((venue) => {
        if (!cancelled) setLoaded({ placeId, venue });
      });
    return () => {
      cancelled = true;
    };
  }, [db, placeId]);

  // `undefined` while loading, `null` when the place is not on the phone.
  const venue = !placeId ? null : loaded?.placeId === placeId ? loaded.venue : undefined;

  if (venue === null) {
    return (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary">{t('place.notFound')}</ThemedText>
      </View>
    );
  }

  if (venue === undefined || draft === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const { primary, secondary } = venueNames(venue, language);
  const writerColor = byId(draft.writer)?.color;

  async function submit(valid: ValidVisitDraft) {
    try {
      await saveNewVisit(db, {
        submissionId: valid.submissionId,
        placeId,
        visitDate: valid.visitDate,
        authorId: valid.writer,
        rating: valid.rating,
        notes: valid.notes,
      });
    } catch {
      return 'visit.saveFailed' as const;
    }
    // Saved. A draft left behind by a failed removal could only resubmit this same visit (idempotent).
    await clear().catch(() => {});
    setWriter(valid.writer);
    closeForm();
    return null;
  }

  async function discard() {
    await clear();
    closeForm();
  }

  return (
    <VisitForm
      header={
        <View style={styles.header}>
          <ThemedText type="title">{primary ?? t('place.unnamed')}</ThemedText>
          {secondary ? <ThemedText themeColor="textSecondary">{secondary}</ThemedText> : null}
        </View>
      }
      draft={draft}
      onChange={update}
      showDate
      ratingColor={writerColor ? theme[writerColor] : theme.accent}
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
