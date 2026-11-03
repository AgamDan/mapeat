import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getPlace } from '@/data/places';
import { commonsFileName, fetchCommonsPhoto, type CommonsPhoto } from '@/features/catalog/commons';
import { addressLine, cuisineLabels, KIND_LABEL_KEYS, venueNames } from '@/features/catalog/labels';
import type { Venue } from '@/features/catalog/types';
import { usePeople } from '@/features/people/use-people';
import { MenuPhotosSection } from '@/features/photos/menu-photos-section';
import { usePhotosForVisits } from '@/features/photos/use-photos-for-visits';
import { useCoverPhoto, useHeaderPhoto } from '@/features/photos/use-place-photos';
import { photoUri } from '@/features/photos/photo-files';
import { PlaceTagsRow } from '@/features/tags/place-tags-row';
import { PlaceSummary } from '@/features/visits/place-summary';
import { usePlaceJournal } from '@/features/visits/use-place-journal';
import { VisitCard } from '@/features/visits/visit-card';
import { PlaceJournalActions } from '@/features/wishlist/place-journal-actions';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';

function withScheme(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Opens a link in the in-app browser; a failure (e.g. offline) is ignored rather than crashing. */
function openInBrowser(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => {});
}

/** Hands a URL to another app (e.g. Apple Maps); failures are ignored. */
function openExternal(url: string) {
  Linking.openURL(url).catch(() => {});
}

export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const t = useT();
  const theme = useTheme();
  const { language } = useLanguage();
  // `undefined` while loading, `null` when the place is not in the cache.
  const [venue, setVenue] = useState<Venue | null | undefined>(undefined);
  const [photo, setPhoto] = useState<CommonsPhoto | null>(null);
  const { journal, error: journalError, retry: retryJournal } = usePlaceJournal(id);
  const { people, ready: peopleReady } = usePeople();
  const cover = useCoverPhoto(id);
  const headerPhoto = useHeaderPhoto(id);
  const photosFor = usePhotosForVisits(journal?.visits.map((visit) => visit.id) ?? []);

  useEffect(() => {
    let cancelled = false;
    getPlace(db, id)
      .catch(() => null)
      .then((result) => {
        if (!cancelled) setVenue(result);
      });
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  const fileName = commonsFileName(venue?.wikimediaCommons ?? null);
  useEffect(() => {
    if (!fileName) return;
    let cancelled = false;
    fetchCommonsPhoto(fileName).then((result) => {
      if (!cancelled) setPhoto(result);
    });
    return () => {
      cancelled = true;
    };
  }, [fileName]);

  if (venue === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (venue === null) {
    return (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary">{t('place.notFound')}</ThemedText>
      </View>
    );
  }

  const { primary, secondary } = venueNames(venue, language);
  const details = [t(KIND_LABEL_KEYS[venue.kind]), ...cuisineLabels(venue.cuisine, language)].join(' · ');
  const address = addressLine(venue);
  const mapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(primary ?? t(KIND_LABEL_KEYS[venue.kind]))}&ll=${venue.lat},${venue.lon}`;
  // Google Maps URLs (no key, no billing): searching name + address finds the listing with its photos.
  const googleQuery = [venue.name ?? primary, address ?? `${venue.lat},${venue.lon}`].filter(Boolean).join(', ');
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleQuery)}`;
  const osmUrl = `https://www.openstreetmap.org/${venue.osmType}/${venue.osmId}`;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {photo ? (
        <View style={styles.photoBlock}>
          <Image
            source={{ uri: photo.imageUrl }}
            style={[styles.photo, { backgroundColor: theme.chip }]}
            contentFit="cover"
            accessibilityLabel={primary ?? undefined}
          />
          <Pressable accessibilityRole="link" onPress={() => openInBrowser(photo.pageUrl)}>
            <ThemedText type="small" themeColor="textSecondary">
              {`${t('place.photoCredit')}: ${photo.author} · ${photo.license} · Wikimedia Commons`}
            </ThemedText>
          </Pressable>
        </View>
      ) : headerPhoto ? (
        // No public photo: show the couple's own photo, clearly marked as theirs (private).
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={t('photos.ourPhoto')}
          onPress={() => router.push({ pathname: '/photo/[id]', params: { id: headerPhoto.id } })}
          style={styles.photoBlock}>
          <Image
            source={{ uri: photoUri(headerPhoto.fileName) }}
            style={[styles.photo, { backgroundColor: theme.chip }]}
            contentFit="cover"
          />
          <View style={[styles.ourPhotoBadge, { backgroundColor: theme.card }]}>
            <ThemedText type="smallBold" themeColor="accent">
              {t('photos.ourPhoto')}
            </ThemedText>
          </View>
        </Pressable>
      ) : (
        <View style={[styles.placeholder, { borderColor: theme.line, backgroundColor: theme.backgroundRaised }]}>
          <ThemedText themeColor="textSecondary">{t('place.noPhoto')}</ThemedText>
        </View>
      )}

      <View style={styles.heading}>
        <ThemedText type="title">{primary ?? t('place.unnamed')}</ThemedText>
        {secondary ? <ThemedText themeColor="textSecondary">{secondary}</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">
          {details}
        </ThemedText>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/visit/new', params: { placeId: venue.id } })}
        style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
        <ThemedText type="defaultBold" themeColor="onAccent">
          {t('visit.add')}
        </ThemedText>
      </Pressable>

      <PlaceJournalActions placeId={venue.id} placeName={primary ?? t('place.unnamed')} journal={journal} />

      <PlaceTagsRow placeId={venue.id} />

      {address ? <Detail label={t('place.address')} value={address} /> : null}
      {venue.openingHours ? <Detail label={t('place.hours')} value={venue.openingHours} /> : null}
      {venue.website ? (
        <Pressable accessibilityRole="link" onPress={() => openInBrowser(withScheme(venue.website!))}>
          <Detail label={t('place.website')} value={venue.website} link />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => openExternal(mapsUrl)}
        style={({ pressed }) => [styles.button, { borderColor: theme.line }, pressed && styles.pressed]}>
        <ThemedText type="defaultBold">{t('place.openInMaps')}</ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={() => openExternal(googleMapsUrl)}
        style={({ pressed }) => [styles.button, { borderColor: theme.line }, pressed && styles.pressed]}>
        <ThemedText type="defaultBold">{t('place.seeOnGoogle')}</ThemedText>
      </Pressable>

      <View style={styles.section}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {t('place.ourVisits')}
        </ThemedText>
        {journal && peopleReady ? (
          journal.visits.length > 0 ? (
            <>
              <PlaceSummary
                people={people}
                averages={journal.averages}
                visitCount={journal.visits.length}
                cover={cover}
              />
              {journal.visits.map((visit) => (
                <VisitCard key={visit.id} visit={visit} people={people} photos={photosFor(visit.id)} />
              ))}
            </>
          ) : (
            <ThemedText themeColor="textSecondary">{t('place.noVisitsYet')}</ThemedText>
          )
        ) : journalError ? (
          <View style={styles.section}>
            <ThemedText themeColor="textSecondary">{t('place.journalLoadFailed')}</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={retryJournal}
              style={({ pressed }) => [styles.button, { borderColor: theme.line }, pressed && styles.pressed]}>
              <ThemedText type="defaultBold">{t('map.retry')}</ThemedText>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
      </View>

      <MenuPhotosSection placeId={venue.id} />

      <Pressable accessibilityRole="link" onPress={() => openInBrowser(osmUrl)}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('place.dataSource')}
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

function Detail({ label, value, link = false }: { label: string; value: string; link?: boolean }) {
  return (
    <View style={styles.detail}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText
        themeColor={link ? 'accent' : 'text'}
        // URLs are Latin text; in Hebrew, right-to-left order would scramble their punctuation.
        style={link ? styles.ltrText : undefined}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  ourPhotoBadge: {
    position: 'absolute',
    top: Spacing.two,
    start: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  ltrText: {
    writingDirection: 'ltr',
  },
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
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  photoBlock: {
    gap: Spacing.one,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: Radius.card,
  },
  placeholder: {
    height: 120,
    borderRadius: Radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    gap: Spacing.half,
  },
  detail: {
    gap: Spacing.half,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
  },
  section: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
