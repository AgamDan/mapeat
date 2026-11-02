import { useCallback, useImperativeHandle, useRef, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, type MapPressEvent, type MKPointOfInterestCategoryType } from 'react-native-maps';

import type { Region } from '@/features/catalog/tiles';
import type { Venue } from '@/features/catalog/types';
import { venueAtPoint, type Size } from '@/features/map/hit-test';
import { useTheme } from '@/hooks/use-theme';
import type { ColorScheme } from '@/constants/theme';

export type JournalMapHandle = {
  animateTo: (latitude: number, longitude: number) => void;
};

export type JournalMapProps = {
  ref?: Ref<JournalMapHandle>;
  initialRegion: Region;
  venues: Venue[];
  selectedId: string | null;
  scheme: ColorScheme;
  showsUserLocation: boolean;
  venueLabel: (venue: Venue) => string;
  onSelectVenue: (id: string) => void;
  onRegionChangeComplete: (region: Region) => void;
};

/**
 * Apple's own restaurant labels can't be tapped for data, so food categories are hidden and our
 * OpenStreetMap venues are drawn instead. Non-food landmarks stay for orientation.
 */
const ORIENTATION_POIS: MKPointOfInterestCategoryType[] = [
  'park',
  'beach',
  'museum',
  'publicTransport',
  'landmark',
  'theater',
  'library',
  'hospital',
];

/** Tap tolerance around a venue dot, in points (about a fingertip). */
const TAP_RADIUS = 24;
/** A marker tap and the map tap it also triggers arrive ~300 ms apart; treat them as one. */
const SELECT_DEBOUNCE_MS = 800;

/** The app's only map. Swap this file (and its `.web` sibling) to change map renderers. */
export function JournalMap({
  ref,
  initialRegion,
  venues,
  selectedId,
  scheme,
  showsUserLocation,
  venueLabel,
  onSelectVenue,
  onRegionChangeComplete,
}: JournalMapProps) {
  const mapRef = useRef<MapView>(null);
  const theme = useTheme();
  const region = useRef<Region>(initialRegion);
  const size = useRef<Size>({ width: 0, height: 0 });
  const lastSelectAt = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      animateTo: (latitude, longitude) =>
        mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 },
          500,
        ),
    }),
    [],
  );

  const select = useCallback(
    (id: string) => {
      const now = Date.now();
      if (now - lastSelectAt.current < SELECT_DEBOUNCE_MS) return;
      lastSelectAt.current = now;
      onSelectVenue(id);
    },
    [onSelectVenue],
  );

  // Every tap on the map arrives here, including taps on markers. If the marker itself didn't
  // report the tap (custom marker views can end up with a tiny native hit area on iOS), pick the
  // venue drawn under the finger.
  const onMapPress = useCallback(
    (event: MapPressEvent) => {
      if (Date.now() - lastSelectAt.current < SELECT_DEBOUNCE_MS) return;
      const id = venueAtPoint(venues, region.current, size.current, event.nativeEvent.position, TAP_RADIUS);
      if (id) select(id);
    },
    [venues, select],
  );

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        size.current = event.nativeEvent.layout;
      }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        userInterfaceStyle={scheme}
        pointsOfInterestFilter={ORIENTATION_POIS}
        showsUserLocation={showsUserLocation}
        showsCompass={false}
        pitchEnabled={false}
        rotateEnabled={false}
        onPress={onMapPress}
        onRegionChangeComplete={(next) => {
          region.current = next;
          onRegionChangeComplete(next);
        }}>
        {venues.map((venue) => {
          const selected = venue.id === selectedId;
          return (
            <Marker
              // Re-mount on selection change so the custom view re-renders on the native side.
              key={`${venue.id}:${selected ? 1 : 0}`}
              coordinate={{ latitude: venue.lat, longitude: venue.lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              accessibilityLabel={venueLabel(venue)}
              zIndex={selected ? 2 : 1}
              onPress={() => select(venue.id)}>
              {/* collapsable={false}: otherwise the new architecture flattens this layout-only
                  wrapper, the native marker shrinks to the dot, and taps miss it. */}
              <View collapsable={false} style={styles.hitArea}>
                <View
                  style={[
                    selected ? styles.selected : styles.dot,
                    {
                      backgroundColor: selected ? theme.accent : theme.textSecondary,
                      borderColor: theme.card,
                    },
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  selected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
  },
});
