import { memo, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { Radius } from '@/constants/theme';
import type { MapPlace } from '@/data/journal';
import { photoUri } from '@/features/photos/photo-files';
import { useTheme } from '@/hooks/use-theme';

/** A heart drawn from a square turned 45° and two circles on its upper edges. */
export function Heart({ size, color }: { size: number; color: string }) {
  const offset = size / (2 * Math.SQRT2);
  const width = 2 * offset + size;
  const centerX = width / 2;
  const centerY = offset + size / 2;
  const height = centerY + size / Math.SQRT2;
  const part = { position: 'absolute', width: size, height: size, backgroundColor: color } as const;

  return (
    <View style={{ width, height }}>
      <View
        style={[part, { top: centerY - size / 2, start: centerX - size / 2, transform: [{ rotate: '45deg' }] }]}
      />
      <View
        style={[
          part,
          { borderRadius: size / 2, top: centerY - offset - size / 2, start: centerX - offset - size / 2 },
        ]}
      />
      <View
        style={[
          part,
          { borderRadius: size / 2, top: centerY - offset - size / 2, start: centerX + offset - size / 2 },
        ]}
      />
    </View>
  );
}

/** A filled heart with an outline, readable on any map background. */
function OutlinedHeart({ size, fill, outline }: { size: number; fill: string; outline: string }) {
  return (
    <View style={styles.center}>
      <Heart size={size + 4} color={outline} />
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Heart size={size} color={fill} />
      </View>
    </View>
  );
}

function PinBody({
  place,
  selected,
  photoFile,
  onPhotoReady,
}: {
  place: MapPlace;
  selected: boolean;
  photoFile?: string;
  onPhotoReady: () => void;
}) {
  const theme = useTheme();

  if (photoFile) {
    const size = selected ? 52 : 42;
    return (
      <View style={[styles.photoHitArea, { width: size + 12, height: size + 12 }]} collapsable={false}>
        <View
          style={[
            styles.photoFrame,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: selected ? theme.accent : theme.card,
              backgroundColor: theme.card,
            },
          ]}>
          <Image
            source={{ uri: photoUri(photoFile) }}
            style={styles.photo}
            resizeMode="cover"
            onLoad={onPhotoReady}
            onError={onPhotoReady}
          />
        </View>
        {place.wantReturn ? (
          <View style={[styles.badge, { backgroundColor: theme.card }]}>
            <Heart size={6} color={theme.accent} />
          </View>
        ) : null}
      </View>
    );
  }

  if (place.status === 'visited') {
    const size = selected ? 30 : 24;
    return (
      <View style={[styles.hitArea, styles.journalHitArea]} collapsable={false}>
        <View
          style={[
            styles.postcard,
            {
              width: size,
              height: size,
              backgroundColor: theme.accent,
              borderColor: selected ? theme.text : theme.card,
            },
          ]}>
          <View style={[styles.stamp, { borderColor: theme.card }]} />
        </View>
        {place.wantReturn ? (
          <View style={[styles.badge, { backgroundColor: theme.card }]}>
            <Heart size={6} color={theme.accent} />
          </View>
        ) : null}
      </View>
    );
  }

  if (place.status === 'wishlist') {
    return (
      <View style={[styles.hitArea, styles.journalHitArea]} collapsable={false}>
        <OutlinedHeart
          size={selected ? 15 : 11}
          fill={theme.accent}
          outline={selected ? theme.text : theme.card}
        />
      </View>
    );
  }

  return (
    <View style={styles.hitArea} collapsable={false}>
      <View
        style={[
          selected ? styles.selectedDot : styles.dot,
          { backgroundColor: selected ? theme.accent : theme.textSecondary, borderColor: theme.card },
        ]}
      />
    </View>
  );
}

type PlaceMarkerProps = {
  place: MapPlace;
  selected: boolean;
  label: string;
  /** Our photo for this place (only when zoomed in close). */
  photoFile?: string;
  onSelect: (id: string) => void;
};

function zIndexOf(place: MapPlace, selected: boolean, hasPhoto: boolean) {
  if (selected) return 10;
  if (hasPhoto) return 4;
  if (place.status === 'visited') return 3;
  if (place.status === 'wishlist') return 2;
  return 1;
}

/** If a photo never reports loading, stop redrawing the marker after this long anyway. */
const PHOTO_READY_TIMEOUT_MS = 3_000;
/** After the image loads, keep redrawing briefly so the native marker snapshot includes it. */
const PHOTO_SETTLE_MS = 400;

/**
 * One place on the map. Memoized on what it draws, so re-querying places (a new array of new
 * objects) doesn't re-render every marker. The parent keys it by everything that changes its
 * look, because with `tracksViewChanges={false}` a changed view must be re-mounted to update.
 * A photo pin keeps tracking view changes until its image has loaded, or the image wouldn't show.
 */
export const PlaceMarker = memo(
  function PlaceMarker({ place, selected, label, photoFile, onSelect }: PlaceMarkerProps) {
    const [photoReady, setPhotoReady] = useState(false);
    const [photoLoaded, setPhotoLoaded] = useState(false);
    const showsPhoto = photoFile != null;

    useEffect(() => {
      if (!showsPhoto) return;
      const timer = setTimeout(() => setPhotoReady(true), photoLoaded ? PHOTO_SETTLE_MS : PHOTO_READY_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }, [showsPhoto, photoLoaded]);

    return (
      <Marker
        coordinate={{ latitude: place.lat, longitude: place.lon }}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={showsPhoto && !photoReady}
        accessibilityLabel={label}
        zIndex={zIndexOf(place, selected, showsPhoto)}
        onPress={() => onSelect(place.id)}>
        {/* The root has collapsable={false}: otherwise the new architecture flattens this
            layout-only wrapper, the native marker shrinks to the drawing, and taps miss it. */}
        <PinBody
          place={place}
          selected={selected}
          photoFile={photoFile}
          onPhotoReady={() => setPhotoLoaded(true)}
        />
      </Marker>
    );
  },
  (prev, next) =>
    prev.place.id === next.place.id &&
    prev.place.lat === next.place.lat &&
    prev.place.lon === next.place.lon &&
    prev.place.status === next.place.status &&
    prev.place.wantReturn === next.place.wantReturn &&
    prev.selected === next.selected &&
    prev.label === next.label &&
    prev.photoFile === next.photoFile &&
    prev.onSelect === next.onSelect,
);

/** Key for a marker: changes whenever its drawing changes (see `PlaceMarker`). */
export function placeMarkerKey(place: MapPlace, selected: boolean, scheme: string, photoFile?: string) {
  return `${place.id}:${place.status}:${place.wantReturn ? 1 : 0}:${selected ? 1 : 0}:${scheme}:${photoFile ?? ''}`;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitArea: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalHitArea: {
    width: 36,
    height: 36,
  },
  photoHitArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFrame: {
    borderWidth: 3,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  selectedDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
  },
  postcard: {
    borderRadius: Radius.small,
    borderWidth: 2.5,
    transform: [{ rotate: '-8deg' }],
  },
  stamp: {
    position: 'absolute',
    top: 2,
    end: 2,
    width: 7,
    height: 8,
    borderWidth: 1.5,
    borderRadius: 1,
  },
  badge: {
    position: 'absolute',
    top: 0,
    end: 0,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
