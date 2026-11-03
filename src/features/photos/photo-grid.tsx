import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Photo } from '@/data/photos';
import { PhotoThumb } from '@/features/photos/photo-thumb';

const COLUMNS = 4;
const GAP = Spacing.two;

/** Photos as a wrapping grid of square thumbnails that fill the available width. */
export function PhotoGrid({ photos }: { photos: Photo[] }) {
  const [width, setWidth] = useState(0);
  const size = width > 0 ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : 0;

  return (
    <View style={styles.grid} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {size > 0 ? photos.map((photo) => <PhotoThumb key={photo.id} photo={photo} size={size} />) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
});
