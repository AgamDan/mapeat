import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { Photo } from '@/data/photos';
import { PhotoThumb } from '@/features/photos/photo-thumb';
import { useVisitPhotos } from '@/features/photos/use-visit-photos';
import { useTheme } from '@/hooks/use-theme';

const SHOWN = 4;
const SIZE = 48;

type VisitPhotoStripProps = {
  visitId: string;
  /** Already-loaded photos (e.g. batch-loaded for a list); loaded here when `undefined`. */
  photos?: Photo[];
  /** Makes the "+N" tile open the visit screen. */
  openVisit?: boolean;
};

/** A compact row of a visit's first photos, with "+N" for the rest. Renders nothing without photos. */
export function VisitPhotoStrip({ visitId, photos: given, openVisit = false }: VisitPhotoStripProps) {
  const theme = useTheme();
  const loaded = useVisitPhotos(visitId, given !== undefined);
  const photos = given ?? loaded;
  if (!photos || photos.length === 0) return null;

  const extra = photos.length - SHOWN;
  const more =
    extra > 0 ? (
      <View style={[styles.more, { backgroundColor: theme.chip }]}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.moreText}>
          {`+${extra}`}
        </ThemedText>
      </View>
    ) : null;

  return (
    <View style={styles.strip}>
      {photos.slice(0, SHOWN).map((photo) => (
        <PhotoThumb key={photo.id} photo={photo} size={SIZE} />
      ))}
      {more && openVisit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`+${extra}`}
          onPress={() => router.push({ pathname: '/visit/[id]', params: { id: visitId } })}
          style={({ pressed }) => pressed && styles.pressed}>
          {more}
        </Pressable>
      ) : (
        more
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  more: {
    width: SIZE,
    height: SIZE,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    writingDirection: 'ltr',
  },
  pressed: {
    opacity: 0.6,
  },
});
