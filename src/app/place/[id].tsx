import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Postcard } from '@/components/postcard';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getPlace } from '@/data/places';
import { commonsFileName, fetchCommonsPhoto, type CommonsPhoto } from '@/features/catalog/commons';
import { addressLine, cuisineLabels, KIND_LABEL_KEYS, venueNames } from '@/features/catalog/labels';
import type { Venue } from '@/features/catalog/types';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';

function withScheme(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
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
          <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(photo.pageUrl)}>
            <ThemedText type="small" themeColor="textSecondary">
              {`${t('place.photoCredit')}: ${photo.author} · ${photo.license} · Wikimedia Commons`}
            </ThemedText>
          </Pressable>
        </View>
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

      {address ? <Detail label={t('place.address')} value={address} /> : null}
      {venue.openingHours ? <Detail label={t('place.hours')} value={venue.openingHours} /> : null}
      {venue.website ? (
        <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(withScheme(venue.website!))}>
          <Detail label={t('place.website')} value={venue.website} link />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => Linking.openURL(mapsUrl)}
        style={({ pressed }) => [styles.button, { borderColor: theme.line }, pressed && styles.pressed]}>
        <ThemedText type="defaultBold">{t('place.openInMaps')}</ThemedText>
      </Pressable>

      <Postcard>
        <ThemedText type="subtitle">{t('place.comingTitle')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('place.comingBody')}</ThemedText>
      </Postcard>

      <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(osmUrl)}>
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
      <ThemedText themeColor={link ? 'accent' : 'text'}>{value}</ThemedText>
    </View>
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
  pressed: {
    opacity: 0.7,
  },
});
