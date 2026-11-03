import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceGroup, type Choice } from '@/components/choice-group';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { listTags, type MapFilter, type MapShow, type Tag } from '@/data/journal';
import { useJournalRevision } from '@/data/journal-events';
import { cuisineLabels, KIND_LABEL_KEYS } from '@/features/catalog/labels';
import { VENUE_KINDS, type VenueKind } from '@/features/catalog/types';
import { FilterChip } from '@/features/map/filter-chip';
import { activeFilterCount, resetMapFilter, setMapFilter, useMapFilter } from '@/features/map/map-filter-store';
import { useVisibleCuisines } from '@/features/map/visible-cuisines-store';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';

/** Filter sheet for the map. Changes apply immediately; the map redraws behind the sheet. */
export default function MapFiltersScreen() {
  const t = useT();
  const theme = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const filter = useMapFilter();
  const visibleCuisines = useVisibleCuisines();
  const [tags, setTags] = useState<Tag[] | null>(null);
  const count = activeFilterCount(filter);

  useEffect(() => {
    let active = true;
    listTags(db)
      .then((found) => {
        if (active) setTags(found);
      })
      .catch(() => {
        if (active) setTags([]);
      });
    return () => {
      active = false;
    };
  }, [db, revision]);

  const update = (patch: Partial<MapFilter>) => setMapFilter({ ...filter, ...patch });

  const showChoices: Choice<MapShow>[] = [
    { value: 'all', label: t('filters.showAll') },
    { value: 'journal', label: t('filters.showJournal') },
    { value: 'visited', label: t('filters.showVisited') },
    { value: 'wishlist', label: t('filters.showWishlist') },
  ];

  const toggleKind = (kind: VenueKind) => {
    const kinds = filter.kinds.includes(kind)
      ? filter.kinds.filter((value) => value !== kind)
      : [...filter.kinds, kind];
    // Every type selected means the same as "Any".
    update({ kinds: kinds.length === VENUE_KINDS.length ? [] : kinds });
  };

  // Cuisines among the places loaded on the map, plus the chosen one so it can be cleared.
  const cuisineValues = [...visibleCuisines];
  if (filter.cuisine && !cuisineValues.includes(filter.cuisine)) cuisineValues.push(filter.cuisine);
  const cuisines = cuisineValues
    .map((value) => ({ value, label: cuisineLabels(value, language)[0] ?? value }))
    .sort((a, b) => a.label.localeCompare(b.label, language));

  const toggleTag = (id: string) => {
    update({
      tagIds: filter.tagIds.includes(id)
        ? filter.tagIds.filter((value) => value !== id)
        : [...filter.tagIds, id],
    });
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
      <View style={styles.summary}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.summaryText}>
          {count > 0 ? t('filters.activeCount', { count }) : ''}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: count === 0 }}
          disabled={count === 0}
          onPress={resetMapFilter}
          hitSlop={8}
          style={({ pressed }) => [count === 0 && styles.disabled, pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="accent">
            {t('filters.reset')}
          </ThemedText>
        </Pressable>
      </View>

      <ChoiceGroup
        label={t('filters.show')}
        choices={showChoices}
        value={filter.show}
        onChange={(show) => update({ show })}
      />

      <Section label={t('filters.kind')}>
        <FilterChip
          role="checkbox"
          label={t('filters.any')}
          selected={filter.kinds.length === 0}
          onPress={() => update({ kinds: [] })}
        />
        {VENUE_KINDS.map((kind) => (
          <FilterChip
            key={kind}
            role="checkbox"
            label={t(KIND_LABEL_KEYS[kind])}
            selected={filter.kinds.includes(kind)}
            onPress={() => toggleKind(kind)}
          />
        ))}
      </Section>

      <Section label={t('filters.cuisine')} radio>
        <FilterChip
          role="radio"
          label={t('filters.any')}
          selected={filter.cuisine === null}
          onPress={() => update({ cuisine: null })}
        />
        {cuisines.map((cuisine) => (
          <FilterChip
            key={cuisine.value}
            role="radio"
            label={cuisine.label}
            selected={filter.cuisine === cuisine.value}
            onPress={() => update({ cuisine: cuisine.value })}
          />
        ))}
      </Section>

      <Section label={t('filters.tags')}>
        {tags && tags.length === 0 ? (
          <ThemedText themeColor="textSecondary">{t('tags.none')}</ThemedText>
        ) : (
          <>
            <FilterChip
              role="checkbox"
              label={t('filters.any')}
              selected={filter.tagIds.length === 0}
              onPress={() => update({ tagIds: [] })}
            />
            {(tags ?? []).map((tag) => (
              <FilterChip
                key={tag.id}
                role="checkbox"
                label={tag.name}
                selected={filter.tagIds.includes(tag.id)}
                onPress={() => toggleTag(tag.id)}
              />
            ))}
          </>
        )}
      </Section>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.done, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
        <ThemedText type="defaultBold" style={{ color: theme.onAccent }}>
          {t('filters.done')}
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

function Section({ label, radio = false, children }: { label: string; radio?: boolean; children: ReactNode }) {
  return (
    <View style={styles.section} accessibilityRole={radio ? 'radiogroup' : undefined} accessibilityLabel={label}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  summaryText: {
    flexShrink: 1,
  },
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  done: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
