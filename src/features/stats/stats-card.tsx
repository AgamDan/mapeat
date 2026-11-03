import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Postcard } from '@/components/postcard';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import type { Person } from '@/data/people';
import type { Disagreement, JournalStats, PersonTopPlace } from '@/data/stats';
import { KIND_LABEL_KEYS, venueNames } from '@/features/catalog/labels';
import type { Venue } from '@/features/catalog/types';
import { formatAverage } from '@/features/stats/use-stats';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';

type StatsCardProps = {
  stats: JournalStats;
  /** Both journal members in display order (from `usePeople()`). */
  people: Person[];
};

function usePlaceName() {
  const t = useT();
  const { language } = useLanguage();
  return (venue: Venue | null) =>
    venue ? (venueNames(venue, language).primary ?? t(KIND_LABEL_KEYS[venue.kind])) : t('place.unnamed');
}

/**
 * A small collapsible postcard with this year's counts, each person's own favorites and the
 * visits where they disagreed most. Ratings always stay per person — never combined.
 */
export function StatsCard({ stats, people }: StatsCardProps) {
  const t = useT();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const hasVisits = people.some((person) => stats.topByPerson[person.id].length > 0);

  if (!hasVisits) {
    return (
      <Postcard stamp={String(stats.year)} style={styles.card}>
        <View style={styles.heading}>
          <ThemedText type="subtitle">{t('stats.title')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('stats.empty')}</ThemedText>
        </View>
      </Postcard>
    );
  }

  const counts = `${t('stats.visitsThisYear', { count: stats.visitsThisYear, year: stats.year })} · ${t(
    'stats.placesThisYear',
    { count: stats.placesThisYear },
  )}`;

  return (
    <Postcard stamp={String(stats.year)} style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('stats.title')}, ${counts}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
        <View style={styles.toggleText}>
          <ThemedText type="subtitle">{t('stats.title')}</ThemedText>
          <ThemedText themeColor="textSecondary">{counts}</ThemedText>
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
        <View style={styles.details}>
          {people.map((person) =>
            stats.topByPerson[person.id].length > 0 ? (
              <TopPlaces key={person.id} person={person} places={stats.topByPerson[person.id]} />
            ) : null,
          )}
          {stats.disagreements.length > 0 ? (
            <View style={[styles.section, { borderTopColor: theme.line }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('stats.disagree')}
              </ThemedText>
              {stats.disagreements.map((item) => (
                <DisagreementRow key={item.visitId} item={item} people={people} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Postcard>
  );
}

function TopPlaces({ person, places }: { person: Person; places: PersonTopPlace[] }) {
  const t = useT();
  const theme = useTheme();
  const placeName = usePlaceName();
  const ink = theme[person.color];

  return (
    <View style={[styles.section, { borderTopColor: theme.line }]}>
      <ThemedText type="smallBold" style={{ color: ink }}>
        {t('stats.topFor', { name: person.name })}
      </ThemedText>
      {places.map((place, index) => {
        const name = placeName(place.venue);
        const average = t('stats.average', { value: formatAverage(place.average) });
        return (
          <Pressable
            key={place.placeId}
            accessibilityRole="link"
            accessibilityLabel={`${name}, ${person.name} ${average}`}
            onPress={() => router.push({ pathname: '/place/[id]', params: { id: place.placeId } })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <ThemedText style={[styles.rank, { color: ink }]}>{index + 1}</ThemedText>
            <ThemedText numberOfLines={1} style={styles.rowName}>
              {name}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: ink }}>
              {average}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function DisagreementRow({ item, people }: { item: Disagreement; people: Person[] }) {
  const theme = useTheme();
  const placeName = usePlaceName();
  const name = placeName(item.venue);
  const label = people.map((person) => `${person.name} ${item.ratings[person.id]}/10`).join(', ');

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${name}, ${label}`}
      onPress={() => router.push({ pathname: '/visit/[id]', params: { id: item.visitId } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <ThemedText numberOfLines={1} style={styles.rowName}>
        {name}
      </ThemedText>
      <View style={styles.ratings}>
        {people.map((person) => (
          <View key={person.id} style={[styles.ratingChip, { borderColor: theme[person.color] }]}>
            <ThemedText type="smallBold" style={{ color: theme[person.color] }}>
              {`${person.name} ${item.ratings[person.id]}`}
            </ThemedText>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The stamp sits in the top end corner; only the heading keeps clear of it.
  card: {
    paddingEnd: Spacing.three,
  },
  heading: {
    paddingEnd: 56,
    gap: Spacing.half,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingEnd: 56,
  },
  toggleText: {
    flex: 1,
    gap: Spacing.half,
  },
  details: {
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 36,
  },
  rank: {
    fontFamily: Fonts.displayHeavy,
    fontSize: 18,
    lineHeight: 22,
    minWidth: 14,
  },
  rowName: {
    flex: 1,
  },
  ratings: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  ratingChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  pressed: {
    opacity: 0.6,
  },
});
