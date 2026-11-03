import * as Location from 'expo-location';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { getMapPlace, getMapPlaces, listTags, type MapPlace } from '@/data/journal';
import { useJournalRevision } from '@/data/journal-events';
import { KIND_LABEL_KEYS, venueNames } from '@/features/catalog/labels';
import type { Region } from '@/features/catalog/tiles';
import { useCatalog } from '@/features/catalog/use-catalog';
import { FilterButton } from '@/features/map/filter-button';
import { JournalMap, type JournalMapHandle } from '@/features/map/journal-map';
import { setMapCenter } from '@/features/map/map-center-store';
import {
  activeFilterCount,
  getMapFilter,
  resetMapFilter,
  setMapFilter,
  useMapFilter,
} from '@/features/map/map-filter-store';
import { MapHint } from '@/features/map/map-hint';
import { SearchButton } from '@/features/map/search-button';
import { useMapFocusRequests } from '@/features/map/use-map-focus';
import { useMapPhotos } from '@/features/map/use-map-photos';
import { setVisibleCuisines } from '@/features/map/visible-cuisines-store';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';

/** Central Tel Aviv, the first coverage area. */
const INITIAL_REGION = { latitude: 32.0809, longitude: 34.7806, latitudeDelta: 0.03, longitudeDelta: 0.03 };
const NOTE_DURATION_MS = 4_000;
/** Street-level zoom when flying to a single place (e.g. from search). */
const PLACE_DELTA = 0.006;
/** Zoomed in at least this close (map height in degrees, ~2.8 km), visited places show our photo. */
const PHOTO_PIN_DELTA = 0.025;

export default function MapScreen() {
  const t = useT();
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const { language, direction } = useLanguage();
  const filter = useMapFilter();
  const journalRevision = useJournalRevision();
  const { places, cuisines, hiddenByFilters, status, onRegionChange, retry } = useCatalog(
    filter,
    journalRevision,
  );
  const filterCount = activeFilterCount(filter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showsUserLocation, setShowsUserLocation] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const mapRef = useRef<JournalMapHandle>(null);

  useEffect(() => {
    setVisibleCuisines(cuisines);
  }, [cuisines]);

  // A deleted tag must not keep filtering the map.
  const db = useSQLiteContext();
  const tagFilterActive = filter.tagIds.length > 0;
  useEffect(() => {
    if (!tagFilterActive) return;
    let active = true;
    listTags(db)
      .then((tags) => {
        const current = getMapFilter();
        const known = new Set(tags.map((tag) => tag.id));
        const kept = current.tagIds.filter((id) => known.has(id));
        if (active && kept.length !== current.tagIds.length) setMapFilter({ ...current, tagIds: kept });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [db, tagFilterActive, journalRevision]);

  const placeLabel = useCallback(
    (place: MapPlace) => {
      const name = venueNames(place, language).primary ?? t(KIND_LABEL_KEYS[place.kind]);
      if (place.status === 'visited') {
        const visited = `${name}, ${t('filters.showVisited')}`;
        return place.wantReturn ? `${visited}, ${t('wishlist.wantToGoBack')}` : visited;
      }
      if (place.status === 'wishlist') return `${name}, ${t('wishlist.on')}`;
      return name;
    },
    [language, t],
  );

  const openPlace = useCallback((id: string) => {
    setSelectedId(id);
    router.push({ pathname: '/place/[id]', params: { id } });
  }, []);

  // The place opened from search stays on the map even if the filters would hide it,
  // until another place is picked on the map.
  const [searchedId, setSearchedId] = useState<string | null>(null);
  const [searchedResult, setSearchedResult] = useState<{ place: MapPlace; matchesFilter: boolean } | null>(null);
  useEffect(() => {
    if (!searchedId) return;
    let active = true;
    (async () => {
      const place = await getMapPlace(db, searchedId);
      if (!place) return null;
      const near = 0.000_01;
      const bounds = { south: place.lat - near, north: place.lat + near, west: place.lon - near, east: place.lon + near };
      const matching = await getMapPlaces(db, bounds, filter, 50);
      return { place, matchesFilter: matching.some((other) => other.id === place.id) };
    })()
      .then((next) => {
        if (active) setSearchedResult(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [db, searchedId, filter, journalRevision]);

  const pickOnMap = useCallback(
    (id: string) => {
      setSearchedId((current) => (current === id ? current : null));
      openPlace(id);
    },
    [openPlace],
  );

  const searched = searchedResult && searchedResult.place.id === searchedId ? searchedResult : null;
  const searchedHidden = searched != null && !searched.matchesFilter;
  const shownPlaces =
    searched && !places.some((place) => place.id === searched.place.id) ? [...places, searched.place] : places;
  const [zoomedClose, setZoomedClose] = useState(INITIAL_REGION.latitudeDelta <= PHOTO_PIN_DELTA);
  const photoFiles = useMapPhotos(shownPlaces, zoomedClose);

  const flyToPlace = useCallback((latitude: number, longitude: number, placeId: string) => {
    setSearchedId(placeId);
    mapRef.current?.animateTo(latitude, longitude, PLACE_DELTA);
  }, []);

  useMapFocusRequests(flyToPlace, openPlace);

  const regionChanged = useCallback(
    (region: Region) => {
      setMapCenter(region.latitude, region.longitude);
      setZoomedClose(region.latitudeDelta <= PHOTO_PIN_DELTA);
      onRegionChange(region);
    },
    [onRegionChange],
  );

  const locate = useCallback(async () => {
    // Permission is requested only when the user asks for their location.
    const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (!permission?.granted) {
      setLocationDenied(true);
      setTimeout(() => setLocationDenied(false), NOTE_DURATION_MS);
      return;
    }
    setShowsUserLocation(true);
    try {
      const position =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      mapRef.current?.animateTo(position.coords.latitude, position.coords.longitude);
    } catch {
      setLocationDenied(true);
      setTimeout(() => setLocationDenied(false), NOTE_DURATION_MS);
    }
  }, []);

  // Background refreshes stay quiet while places are on screen; only an empty map explains itself.
  const nothingShown = places.length === 0;
  const showError = status === 'error' && nothingShown && !hiddenByFilters;
  const showLoading = status === 'loading' && nothingShown;
  // Zoomed out, our own places are drawn anyway; only "All places" still needs zooming in.
  const showZoomIn = status === 'zoomIn' && filter.show === 'all';
  const note = locationDenied
    ? t('map.locationDenied')
    : showLoading
      ? t('map.loading')
      : showZoomIn
        ? t('map.zoomIn')
        : showError
          ? t('map.error')
          : hiddenByFilters
            ? t('filters.noResults')
            : null;

  return (
    <View style={styles.screen}>
      <JournalMap
        ref={mapRef}
        initialRegion={INITIAL_REGION}
        places={shownPlaces}
        selectedId={selectedId}
        scheme={scheme}
        showsUserLocation={showsUserLocation}
        placeLabel={placeLabel}
        onSelectPlace={pickOnMap}
        onRegionChangeComplete={regionChanged}
        photoFiles={photoFiles}
      />

      <View pointerEvents="box-none" style={styles.top}>
        <ScreenHeader title={t('appName')} floating brand />
        {note ? (
          <View style={[styles.note, { backgroundColor: theme.card }]}>
            {showLoading && !locationDenied ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : null}
            <ThemedText type="small" style={styles.noteText}>
              {note}
            </ThemedText>
            {showError && !locationDenied ? (
              <Pressable accessibilityRole="button" onPress={retry} hitSlop={8}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('map.retry')}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <MapHint />
      </View>

      <SafeAreaView edges={['bottom']} pointerEvents="box-none" style={styles.bottom}>
        <SearchButton onPress={() => router.push('/search')} />
        <View style={styles.filterRow}>
          {searchedHidden ? (
            <View style={[styles.filtersOn, { backgroundColor: theme.card, direction }]}>
              <ThemedText type="small">{t('filters.onNote')}</ThemedText>
              <Pressable accessibilityRole="button" onPress={resetMapFilter} hitSlop={10}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('filters.clear')}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
          <FilterButton activeCount={filterCount} onPress={() => router.push('/map-filters')} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.locate')}
          onPress={locate}
          style={({ pressed }) => [
            styles.locate,
            { backgroundColor: theme.card },
            pressed && styles.pressed,
          ]}>
          <SymbolView
            name={{ ios: 'location', android: 'my_location', web: 'my_location' }}
            size={20}
            tintColor={theme.accent}
          />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const shadow = {
  shadowColor: '#503214',
  shadowOpacity: 0.2,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
} as const;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  top: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    gap: Spacing.two,
  },
  note: {
    ...shadow,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: '90%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  noteText: {
    flexShrink: 1,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    // Apple Maps always draws its logo bottom-left, so keep the map buttons bottom-right in both languages.
    direction: 'ltr',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  locate: {
    ...shadow,
    width: 46,
    height: 46,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  filtersOn: {
    ...shadow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.7,
  },
});
