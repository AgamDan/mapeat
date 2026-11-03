import { ActivityIndicator, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import type { Photo } from '@/data/photos';
import { PhotoThumb } from '@/features/photos/photo-thumb';
import { useAddPhotos } from '@/features/photos/use-add-photos';
import { useMenuPhotos } from '@/features/photos/use-place-photos';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';
import { formatVisitDate, fromPickerDate } from '@/lib/dates';

/** How many menu photos one library pick may add; there is no total limit for menu photos. */
const MENU_PICK_LIMIT = 10;
const COLUMNS = 3;
const GAP = Spacing.two;

/** Calendar date a photo was taken (else added), in the phone's time zone. */
function photoDate(photo: Photo) {
  return fromPickerDate(new Date(photo.takenAt ?? photo.createdAt));
}

/**
 * The place's private "Menu" photos: newest first with the date taken, addable before any
 * visit and anytime later. Never shown in the public profile photo slot.
 */
export function MenuPhotosSection({ placeId }: { placeId: string }) {
  const t = useT();
  const theme = useTheme();
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const { photos, error, retry } = useMenuPhotos(placeId);
  const { add, adding } = useAddPhotos({ kind: 'menu', placeId, visitId: null }, MENU_PICK_LIMIT);

  // Matches the place screen's content padding (Spacing.three on each side).
  const contentWidth = Math.min(width, MaxContentWidth) - Spacing.three * 2;
  const size = Math.floor((contentWidth - GAP * (COLUMNS - 1)) / COLUMNS);
  const webOnly = Platform.OS === 'web';

  let body;
  if (photos === null) {
    body = error ? (
      <>
        <ThemedText themeColor="textSecondary">{t('place.journalLoadFailed')}</ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={retry}
          style={({ pressed }) => [styles.button, { borderColor: theme.line }, pressed && styles.pressed]}>
          <ThemedText type="defaultBold">{t('map.retry')}</ThemedText>
        </Pressable>
      </>
    ) : (
      <ActivityIndicator color={theme.accent} />
    );
  } else if (photos.length === 0) {
    body = <ThemedText themeColor="textSecondary">{t('photos.menuEmpty')}</ThemedText>;
  } else {
    body = (
      <View style={styles.grid}>
        {photos.map((photo) => (
          <View key={photo.id} style={[styles.cell, { width: size }]}>
            <PhotoThumb photo={photo} size={size} />
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {formatVisitDate(photoDate(photo), language, 'short')}
            </ThemedText>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" accessibilityRole="header">
        {t('photos.menu')}
      </ThemedText>
      {webOnly ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('photos.webUnavailable')}
        </ThemedText>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: adding }}
          disabled={adding}
          onPress={() => add()}
          style={({ pressed }) => [
            styles.button,
            { borderColor: theme.line },
            (pressed || adding) && styles.pressed,
          ]}>
          {adding ? (
            <View style={styles.adding}>
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="defaultBold">{t('photos.adding')}</ThemedText>
            </View>
          ) : (
            <ThemedText type="defaultBold">{t('photos.addMenu')}</ThemedText>
          )}
        </Pressable>
      )}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  adding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
