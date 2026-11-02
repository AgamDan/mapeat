import { useImperativeHandle, useRef, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, type MKPointOfInterestCategoryType } from 'react-native-maps';

import type { Region } from '@/features/catalog/tiles';
import type { Venue } from '@/features/catalog/types';
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

  return (
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
      onRegionChangeComplete={(region) => onRegionChangeComplete(region)}>
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
            onPress={() => onSelectVenue(venue.id)}>
            <View style={styles.hitArea}>
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
