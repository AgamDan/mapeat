import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useJournalRevision } from '@/data/journal-events';
import type { Person } from '@/data/people';
import { getPlace } from '@/data/places';
import { deleteReview, deleteVisit, getVisit, updateVisitDate, type Visit, type VisitReview } from '@/data/visits';
import { KIND_LABEL_KEYS, venueNames } from '@/features/catalog/labels';
import type { Venue } from '@/features/catalog/types';
import { usePeople } from '@/features/people/use-people';
import { VisitPhotosSection } from '@/features/photos/visit-photos-section';
import { VisitCard } from '@/features/visits/visit-card';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import type { TranslationKey } from '@/i18n/en';
import { useLanguage, useT } from '@/i18n/i18n';
import type { LocalDate } from '@/lib/dates';

type Loaded = { id: string; visit: Visit | null; venue: Venue | null };

/** The visit (`null` once deleted) and its place, re-queried after every journal write. */
function useVisitWithPlace(id: string | undefined) {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const visit = await getVisit(db, id).catch(() => null);
      const venue = visit ? await getPlace(db, visit.placeId).catch(() => null) : null;
      if (!cancelled) setLoaded({ id, visit, venue });
    })();
    return () => {
      cancelled = true;
    };
  }, [db, id, revision]);

  return loaded && loaded.id === id ? loaded : undefined;
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const t = useT();
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const { language } = useLanguage();
  const { people, ready: peopleReady } = usePeople();
  const loaded = useVisitWithPlace(id);
  const [busy, setBusy] = useState(false);
  // Set while this screen deletes the visit, so it closes instead of flashing "not found".
  const [closing, setClosing] = useState(false);

  if (closing) return null;

  if (loaded === undefined || !peopleReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const { visit, venue } = loaded;
  if (!visit) {
    return (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary">{t('visit.notFound')}</ThemedText>
      </View>
    );
  }

  const placeName = venue
    ? (venueNames(venue, language).primary ?? t(KIND_LABEL_KEYS[venue.kind]))
    : t('place.unnamed');
  const reviewed = people.flatMap((person) => {
    const review = visit.reviews[person.id];
    return review ? [{ person, review }] : [];
  });
  const alertOptions = { userInterfaceStyle: scheme } as const;

  const run = async (action: () => Promise<void>, failureKey: TranslationKey) => {
    setBusy(true);
    try {
      await action();
    } catch {
      Alert.alert(t(failureKey), undefined, undefined, alertOptions);
    } finally {
      setBusy(false);
    }
  };

  const changeDate = (date: LocalDate) => {
    if (date === visit.visitDate) return;
    run(() => updateVisitDate(db, visit.id, date), 'visit.changeDateFailed');
  };

  const confirmDeleteReview = (person: Person, review: VisitReview) => {
    const isLast = reviewed.length === 1;
    Alert.alert(
      t('visit.deleteReview'),
      isLast ? t('visit.deleteLastReviewConfirm') : t('visit.deleteReviewConfirm', { name: person.name }),
      [
        { text: t('visit.cancel'), style: 'cancel' },
        {
          text: t('visit.delete'),
          style: 'destructive',
          onPress: () =>
            run(async () => {
              if (isLast) setClosing(true);
              try {
                const { visitDeleted } = await deleteReview(db, review.id);
                if (visitDeleted) close();
                else setClosing(false);
              } catch (error) {
                setClosing(false);
                throw error;
              }
            }, 'visit.deleteFailed'),
        },
      ],
      alertOptions,
    );
  };

  const confirmDeleteVisit = () => {
    Alert.alert(
      t('visit.deleteVisit'),
      t('visit.deleteVisitConfirm'),
      [
        { text: t('visit.cancel'), style: 'cancel' },
        {
          text: t('visit.delete'),
          style: 'destructive',
          onPress: () =>
            run(async () => {
              setClosing(true);
              try {
                await deleteVisit(db, visit.id);
                close();
              } catch (error) {
                setClosing(false);
                throw error;
              }
            }, 'visit.deleteFailed'),
        },
      ],
      alertOptions,
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ThemedText type="title">{placeName}</ThemedText>

      <VisitCard visit={visit} people={people} openable={false} showPhotos={false} />

      <VisitPhotosSection placeId={visit.placeId} visitId={visit.id} />

      <View style={[styles.panel, { borderColor: theme.line, backgroundColor: theme.backgroundRaised }]}>
        <DateField label={t('visit.changeDate')} value={visit.visitDate} onChange={changeDate} />
      </View>

      <View style={styles.actions}>
        {reviewed.map(({ person, review }) => (
          <Pressable
            key={person.id}
            accessibilityRole="button"
            accessibilityLabel={`${t('visit.deleteReview')}: ${person.name}`}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => confirmDeleteReview(person, review)}
            style={({ pressed }) => [
              styles.button,
              { borderColor: theme.line },
              (pressed || busy) && styles.pressed,
            ]}>
            <ThemedText type="defaultBold" themeColor="accent">
              {t('visit.deleteReview')}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme[person.color] }}>
              {person.name}
            </ThemedText>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={confirmDeleteVisit}
          style={({ pressed }) => [
            styles.button,
            { borderColor: theme.accent },
            (pressed || busy) && styles.pressed,
          ]}>
          <ThemedText type="defaultBold" themeColor="accent">
            {t('visit.deleteVisit')}
          </ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  content: {
    padding: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  actions: {
    gap: Spacing.two,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
