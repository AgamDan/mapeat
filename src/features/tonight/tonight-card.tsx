import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Postcard } from '@/components/postcard';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { VenueKind } from '@/features/catalog/types';
import { cuisineLabels, KIND_LABEL_KEYS, venueNames } from '@/features/catalog/labels';
import { photoUri } from '@/features/photos/photo-files';
import { useHeaderPhoto } from '@/features/photos/use-place-photos';
import { formatKm } from '@/features/tonight/geo';
import type { RankedCandidate } from '@/features/tonight/picker';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';

const KIND_SYMBOLS: Record<VenueKind, SymbolViewProps['name']> = {
  restaurant: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  cafe: { ios: 'cup.and.saucer', android: 'local_cafe', web: 'local_cafe' },
  fast_food: { ios: 'takeoutbag.and.cup.and.straw', android: 'fastfood', web: 'fastfood' },
  bar: { ios: 'wineglass', android: 'local_bar', web: 'local_bar' },
  pub: { ios: 'mug', android: 'sports_bar', web: 'sports_bar' },
  ice_cream: { ios: 'snowflake', android: 'icecream', web: 'icecream' },
};

type TonightCardProps = {
  place: RankedCandidate;
  /** While shuffling, a name flashing by instead of the picked place's details. */
  rollingName: string | null;
};

/** The picked place as a postcard: our own photo (if any), names, kind and cuisine, distance, why. */
export function TonightCard({ place, rollingName }: TonightCardProps) {
  const t = useT();
  const theme = useTheme();
  const { language } = useLanguage();
  const photo = useHeaderPhoto(rollingName ? undefined : place.id);
  const kindLabel = t(KIND_LABEL_KEYS[place.kind]);
  const { primary, secondary } = venueNames(place, language);
  const name = primary ?? kindLabel;
  const details = [kindLabel, ...cuisineLabels(place.cuisine, language)].join(' · ');
  const reason = t(place.reason === 'wishlist' ? 'tonight.fromWishlist' : 'tonight.fromGoBack');
  const distance = place.distanceM != null ? t('tonight.distance', { km: formatKm(place.distanceM) }) : null;

  if (rollingName) {
    return (
      <Postcard style={styles.card}>
        <View style={[styles.art, { backgroundColor: theme.chip }]}>
          <SymbolView name={{ ios: 'dice.fill', android: 'casino', web: 'casino' }} size={56} tintColor={theme.accent} />
        </View>
        <ThemedText type="title" numberOfLines={2} style={styles.centered}>
          {rollingName}
        </ThemedText>
      </Postcard>
    );
  }

  return (
    <Postcard
      style={styles.card}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={[name, secondary, details, distance, reason].filter(Boolean).join(', ')}>
      {photo ? (
        <Image
          source={{ uri: photoUri(photo.fileName) }}
          style={[styles.photo, { backgroundColor: theme.chip }]}
          contentFit="cover"
          recyclingKey={photo.id}
          transition={200}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.art, { backgroundColor: theme.chip }]}>
          <SymbolView name={KIND_SYMBOLS[place.kind]} size={56} tintColor={theme.sea} />
        </View>
      )}
      <ThemedText type="title" numberOfLines={2} style={styles.centered}>
        {name}
      </ThemedText>
      {secondary ? (
        <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.centered}>
          {secondary}
        </ThemedText>
      ) : null}
      <ThemedText themeColor="textSecondary" numberOfLines={2} style={styles.centered}>
        {details}
      </ThemedText>
      {distance ? (
        <ThemedText type="defaultBold" style={styles.centered}>
          {distance}
        </ThemedText>
      ) : null}
      <View style={[styles.reason, { backgroundColor: theme.chip }]}>
        <SymbolView
          name={
            place.reason === 'wishlist'
              ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' }
              : { ios: 'arrow.counterclockwise.circle.fill', android: 'replay', web: 'replay' }
          }
          size={14}
          tintColor={place.reason === 'wishlist' ? theme.accent : theme.personB}
        />
        <ThemedText type="smallBold" style={{ color: place.reason === 'wishlist' ? theme.accent : theme.personB }}>
          {reason}
        </ThemedText>
      </View>
    </Postcard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    minHeight: 360,
  },
  photo: {
    width: '100%',
    height: 190,
    borderRadius: Radius.small,
  },
  art: {
    width: '100%',
    height: 190,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    marginTop: Spacing.one,
  },
});
