import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { ListedPlace } from '@/data/journal';
import type { Photo } from '@/data/photos';
import { cuisineLabels, KIND_LABEL_KEYS, venueNames } from '@/features/catalog/labels';
import { PhotoThumb } from '@/features/photos/photo-thumb';
import { TagChips } from '@/features/tags/tag-chips';
import { confirmRemoveMark } from '@/features/wishlist/journal-marks';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';
import { formatVisitDate } from '@/lib/dates';

type Props = {
  /** `cover` comes from `useWishlist()`; rows without one show no thumbnail. */
  place: ListedPlace & { cover?: Photo | null };
  /** Which list the row is in; decides what "remove" clears. */
  mark: 'wishlist' | 'wantReturn';
};

const COVER_SIZE = 56;

/** One wishlist / "want to go back" place: tap to open its profile, ✕ to remove (after asking). */
export function WishlistRow({ place, mark }: Props) {
  const db = useSQLiteContext();
  const t = useT();
  const theme = useTheme();
  const { language } = useLanguage();
  const [busy, setBusy] = useState(false);

  const venue = place.venue;
  const name = (venue && venueNames(venue, language).primary) || t('place.unnamed');
  const details = venue
    ? [t(KIND_LABEL_KEYS[venue.kind]), ...cuisineLabels(venue.cuisine, language)].join(' · ')
    : null;
  const lastVisit =
    mark === 'wantReturn' && place.lastVisitDate
      ? t('wishlist.lastVisit', { date: formatVisitDate(place.lastVisitDate, language, 'short') })
      : null;
  const removeLabel = mark === 'wishlist' ? t('wishlist.remove') : t('wantReturn.remove');

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await confirmRemoveMark(db, t, mark, place.placeId, name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[name, details, lastVisit].filter(Boolean).join(', ')}
        onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.placeId } })}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        {place.cover ? <PhotoThumb photo={place.cover} size={COVER_SIZE} openable={false} /> : null}
        <View style={styles.text}>
          <ThemedText type="defaultBold" numberOfLines={2}>
            {name}
          </ThemedText>
          {details ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {details}
            </ThemedText>
          ) : null}
          {lastVisit ? (
            <ThemedText type="small" themeColor="textSecondary">
              {lastVisit}
            </ThemedText>
          ) : null}
          <TagChips tags={place.tags} />
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
        accessibilityState={{ busy }}
        disabled={busy}
        hitSlop={Spacing.two}
        onPress={remove}
        style={({ pressed }) => [styles.remove, { backgroundColor: theme.chip }, (pressed || busy) && styles.pressed]}>
        <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={14} tintColor={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
    gap: Spacing.one,
  },
  remove: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
