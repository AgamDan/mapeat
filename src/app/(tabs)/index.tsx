import * as Location from 'expo-location';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { KIND_LABEL_KEYS, venueNames } from '@/features/catalog/labels';
import type { Venue } from '@/features/catalog/types';
import { useCatalog } from '@/features/catalog/use-catalog';
import { JournalMap, type JournalMapHandle } from '@/features/map/journal-map';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';

/** Central Tel Aviv, the first coverage area. */
const INITIAL_REGION = { latitude: 32.0809, longitude: 34.7806, latitudeDelta: 0.03, longitudeDelta: 0.03 };
const NOTE_DURATION_MS = 4_000;

export default function MapScreen() {
  const t = useT();
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const { language } = useLanguage();
  const { venues, status, onRegionChange, retry } = useCatalog();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showsUserLocation, setShowsUserLocation] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const mapRef = useRef<JournalMapHandle>(null);

  const venueLabel = useCallback(
    (venue: Venue) => venueNames(venue, language).primary ?? t(KIND_LABEL_KEYS[venue.kind]),
    [language, t],
  );

  const openVenue = useCallback((id: string) => {
    setSelectedId(id);
    router.push({ pathname: '/place/[id]', params: { id } });
  }, []);

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
  const nothingShown = venues.length === 0;
  const showError = status === 'error' && nothingShown;
  const showLoading = status === 'loading' && nothingShown;
  const note = locationDenied
    ? t('map.locationDenied')
    : showLoading
      ? t('map.loading')
      : status === 'zoomIn'
        ? t('map.zoomIn')
        : showError
          ? t('map.error')
          : null;

  return (
    <View style={styles.screen}>
      <JournalMap
        ref={mapRef}
        initialRegion={INITIAL_REGION}
        venues={venues}
        selectedId={selectedId}
        scheme={scheme}
        showsUserLocation={showsUserLocation}
        venueLabel={venueLabel}
        onSelectVenue={openVenue}
        onRegionChangeComplete={onRegionChange}
      />

      <View pointerEvents="box-none" style={styles.top}>
        <ScreenHeader title={t('map.title')} floating />
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
      </View>

      <SafeAreaView edges={['bottom']} pointerEvents="box-none" style={styles.bottom}>
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
    // Apple Maps always draws its logo bottom-left, so keep the locate button bottom-right in both languages.
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
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
  pressed: {
    opacity: 0.7,
  },
});
