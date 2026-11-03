import { useCallback, useImperativeHandle, useRef, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { type MapPressEvent, type MKPointOfInterestCategoryType } from 'react-native-maps';

import type { ColorScheme } from '@/constants/theme';
import type { MapPlace } from '@/data/journal';
import type { Region } from '@/features/catalog/tiles';
import { venueAtPoint, type Size } from '@/features/map/hit-test';
import { PlaceMarker, placeMarkerKey } from '@/features/map/place-pin';

export type JournalMapHandle = {
  /** Fly to a point; `delta` is the span in degrees shown around it (smaller is closer). */
  animateTo: (latitude: number, longitude: number, delta?: number) => void;
};

export type JournalMapProps = {
  ref?: Ref<JournalMapHandle>;
  initialRegion: Region;
  places: MapPlace[];
  selectedId: string | null;
  scheme: ColorScheme;
  showsUserLocation: boolean;
  placeLabel: (place: MapPlace) => string;
  onSelectPlace: (id: string) => void;
  onRegionChangeComplete: (region: Region) => void;
  /** Photo file per place id, drawn as round photo pins (only passed when zoomed in close). */
  photoFiles?: ReadonlyMap<string, string>;
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

/** Tap tolerance around a pin, in points (about a fingertip). */
const TAP_RADIUS = 24;
/** A marker tap and the map tap it also triggers arrive ~300 ms apart; treat them as one. */
const SELECT_DEBOUNCE_MS = 800;

/** The app's only map. Swap this file (and its `.web` sibling) to change map renderers. */
export function JournalMap({
  ref,
  initialRegion,
  places,
  selectedId,
  scheme,
  showsUserLocation,
  placeLabel,
  onSelectPlace,
  onRegionChangeComplete,
  photoFiles,
}: JournalMapProps) {
  const mapRef = useRef<MapView>(null);
  const region = useRef<Region>(initialRegion);
  const size = useRef<Size>({ width: 0, height: 0 });
  const lastSelectAt = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      animateTo: (latitude, longitude, delta = 0.012) =>
        mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: delta, longitudeDelta: delta },
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
      onSelectPlace(id);
    },
    [onSelectPlace],
  );

  // Every tap on the map arrives here, including taps on markers. If the marker itself didn't
  // report the tap (custom marker views can end up with a tiny native hit area on iOS), pick the
  // place drawn under the finger.
  const onMapPress = useCallback(
    (event: MapPressEvent) => {
      if (Date.now() - lastSelectAt.current < SELECT_DEBOUNCE_MS) return;
      const id = venueAtPoint(places, region.current, size.current, event.nativeEvent.position, TAP_RADIUS);
      if (id) select(id);
    },
    [places, select],
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
        {places.map((place) => {
          const selected = place.id === selectedId;
          const photoFile = photoFiles?.get(place.id);
          return (
            <PlaceMarker
              key={placeMarkerKey(place, selected, scheme, photoFile)}
              place={place}
              selected={selected}
              label={placeLabel(place)}
              photoFile={photoFile}
              onSelect={select}
            />
          );
        })}
      </MapView>
    </View>
  );
}
