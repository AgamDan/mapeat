import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Radius } from '@/constants/theme';
import type { Photo } from '@/data/photos';
import { photoUri } from '@/features/photos/photo-files';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

type PhotoThumbProps = {
  photo: Photo;
  size: number;
  /** Opens the full-screen viewer when tapped (default). */
  openable?: boolean;
};

/** A square thumbnail of one private photo; tapping opens `/photo/[id]`. */
export function PhotoThumb({ photo, size, openable = true }: PhotoThumbProps) {
  const theme = useTheme();
  const t = useT();
  const image = (
    <Image
      source={{ uri: photoUri(photo.fileName) }}
      style={[styles.image, { width: size, height: size, backgroundColor: theme.chip }]}
      contentFit="cover"
      recyclingKey={photo.id}
      transition={150}
      accessibilityIgnoresInvertColors
    />
  );
  if (!openable) return image;
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={t('photos.viewerTitle')}
      onPress={() => router.push({ pathname: '/photo/[id]', params: { id: photo.id } })}
      style={({ pressed }) => pressed && styles.pressed}>
      {image}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: Radius.small,
  },
  pressed: {
    opacity: 0.7,
  },
});
