import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Postcard } from '@/components/postcard';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { KIND_LABEL_KEYS, venueNames } from '@/features/catalog/labels';
import { EmptyState } from '@/features/empty/empty-state';
import { areaName } from '@/features/explorer/areas';
import type { ExplorerCity, ExplorerNeighborhood, VisitedPlace } from '@/features/explorer/explorer-data';
import { useExplorer } from '@/features/explorer/use-explorer';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';

/** "3 places · 5 visits" (places omitted when null). */
function useCounts() {
  const t = useT();
  return (places: number | null, visits: number) =>
    [
      places === null ? null : places === 1 ? t('explorer.placesOne') : t('explorer.places', { count: places }),
      visits === 1 ? t('place.visitCountOne') : t('explorer.visits', { count: visits }),
    ]
      .filter(Boolean)
      .join(' · ');
}

/** Explorer progress: the cities and (approximate) neighborhoods we have eaten in. */
export default function ExplorerScreen() {
  const t = useT();
  const theme = useTheme();
  const summary = useExplorer();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  if (summary === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {summary === null ? (
        <EmptyState
          symbol={{ ios: 'exclamationmark.triangle', android: 'error', web: 'error' }}
          title={t('explorer.title')}
          body={t('explorer.loadFailed')}
        />
      ) : summary.placeCount === 0 ? (
        <EmptyState
          symbol={{ ios: 'map', android: 'map', web: 'map' }}
          title={t('explorer.title')}
          body={t('explorer.empty')}
          action={{
            label: t('empty.goToMap'),
            symbol: { ios: 'map', android: 'map', web: 'map' },
            onPress: () => router.navigate('/'),
          }}
        />
      ) : (
        <>
          <Postcard style={styles.headline}>
            <Tally count={summary.cityCount} label={t('explorer.cities')} />
            <View style={[styles.divider, { backgroundColor: theme.line }]} />
            <Tally count={summary.neighborhoodCount} label={t('explorer.neighborhoods')} />
          </Postcard>
          {summary.cities.map((city) => (
            <CityCard
              key={city.key}
              city={city}
              open={open}
              onToggle={(neighborhoodKey) => toggle(`${city.key}/${neighborhoodKey}`)}
            />
          ))}
        </>
      )}
      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('explorer.approxNote')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('place.dataSource')}
        </ThemedText>
      </View>
    </ScrollView>
  );
}

function Tally({ count, label }: { count: number; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.tally} accessible accessibilityLabel={`${count} ${label}`}>
      <ThemedText style={[styles.tallyNumber, { color: theme.accent }]}>{String(count)}</ThemedText>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function CityCard({
  city,
  open,
  onToggle,
}: {
  city: ExplorerCity;
  open: ReadonlySet<string>;
  onToggle: (neighborhoodKey: string) => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const counts = useCounts();
  const name = city.city ? areaName(city.city, language) : t('explorer.unknownArea');

  return (
    <Postcard style={styles.city}>
      <View style={styles.cityHeading}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {name}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{counts(city.places, city.visits)}</ThemedText>
      </View>
      {city.neighborhoods.map((neighborhood) => (
        <NeighborhoodRow
          key={neighborhood.key}
          neighborhood={neighborhood}
          expanded={open.has(`${city.key}/${neighborhood.key}`)}
          onToggle={() => onToggle(neighborhood.key)}
        />
      ))}
    </Postcard>
  );
}

function NeighborhoodRow({
  neighborhood,
  expanded,
  onToggle,
}: {
  neighborhood: ExplorerNeighborhood;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const { language } = useLanguage();
  const counts = useCounts();
  const name = neighborhood.neighborhood
    ? areaName(neighborhood.neighborhood, language)
    : t('explorer.unknownArea');
  const label = counts(neighborhood.places.length, neighborhood.visits);

  return (
    <View style={[styles.neighborhood, { borderTopColor: theme.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${label}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.rowText}>
          <ThemedText type="defaultBold" numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {label}
          </ThemedText>
        </View>
        <SymbolView
          name={
            expanded
              ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
              : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
          }
          size={16}
          tintColor={theme.textSecondary}
        />
      </Pressable>
      {expanded ? (
        <View style={styles.places}>
          {neighborhood.places.map((place) => (
            <PlaceRow key={place.placeId} place={place} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PlaceRow({ place }: { place: VisitedPlace }) {
  const t = useT();
  const theme = useTheme();
  const { language } = useLanguage();
  const counts = useCounts();
  const name = place.venue
    ? (venueNames(place.venue, language).primary ?? t(KIND_LABEL_KEYS[place.venue.kind]))
    : t('place.unnamed');
  const visits = counts(null, place.visits);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${name}, ${visits}`}
      onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.placeId } })}
      style={({ pressed }) => [styles.row, styles.placeRow, pressed && styles.pressed]}>
      <View style={[styles.dot, { backgroundColor: theme.sea }]} />
      <ThemedText numberOfLines={1} style={styles.rowText}>
        {name}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {visits}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  content: {
    padding: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  tally: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  tallyNumber: {
    fontFamily: Fonts.displayHeavy,
    fontSize: 44,
    lineHeight: 50,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  city: {
    gap: Spacing.one,
  },
  cityHeading: {
    gap: Spacing.half,
    paddingBottom: Spacing.two,
  },
  neighborhood: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingVertical: Spacing.one,
  },
  rowText: {
    flex: 1,
  },
  places: {
    paddingBottom: Spacing.two,
  },
  placeRow: {
    paddingStart: Spacing.three,
    minHeight: 40,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footer: {
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
