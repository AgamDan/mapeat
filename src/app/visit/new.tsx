import type { ImagePickerAsset } from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getPlace } from '@/data/places';
import { saveNewVisit } from '@/data/visits';
import { venueNames } from '@/features/catalog/labels';
import type { Venue } from '@/features/catalog/types';
import { usePeople } from '@/features/people/use-people';
import { addPickedPhotos } from '@/features/photos/add-photos';
import { PendingPhotosPicker } from '@/features/photos/pending-photos-picker';
import { newVisitDraftKey, useVisitDraft, type VisitDraft } from '@/features/visits/drafts';
import { useCloseVisitForm, VisitForm, type ValidVisitDraft } from '@/features/visits/visit-form';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
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
  // Picked photos live only in this screen until the visit is saved (they're not part of the draft).
  const [pendingPhotos, setPendingPhotos] = useState<ImagePickerAsset[]>([]);
  const scheme = useResolvedScheme();

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
    let visitId: string;
    try {
      visitId = (
        await saveNewVisit(db, {
          submissionId: valid.submissionId,
          placeId,
          visitDate: valid.visitDate,
          authorId: valid.writer,
          rating: valid.rating,
          notes: valid.notes,
        })
      ).visitId;
    } catch {
      return 'visit.saveFailed' as const;
    }
    // Saved. A draft left behind by a failed removal could only resubmit this same visit (idempotent).
    await clear().catch(() => {});
    setWriter(valid.writer);
    // Photos are added after the visit is saved; a failed photo never undoes the visit.
    if (pendingPhotos.length > 0) {
      void addPickedPhotos(db, pendingPhotos, { kind: 'visit', placeId, visitId, addedBy: valid.writer })
        .then((result) => result.failed)
        .catch(() => pendingPhotos.length)
        .then((failed) => {
          if (failed > 0) {
            Alert.alert(t('photos.someFailed', { count: failed }), undefined, undefined, {
              userInterfaceStyle: scheme,
            });
          }
        });
    }
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
      extra={(saving) => (
        <PendingPhotosPicker assets={pendingPhotos} onChange={setPendingPhotos} disabled={saving} />
      )}
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
