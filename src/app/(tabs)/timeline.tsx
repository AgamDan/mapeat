import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, View } from 'react-native';

import { type Choice, ChoiceGroup } from '@/components/choice-group';
import { Postcard } from '@/components/postcard';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import type { TimelineVisit } from '@/data/journal';
import type { PersonId } from '@/data/people';
import { venueNames } from '@/features/catalog/labels';
import { EmptyState } from '@/features/empty/empty-state';
import { usePeople } from '@/features/people/use-people';
import { usePhotosForVisits } from '@/features/photos/use-photos-for-visits';
import { StatsCard } from '@/features/stats/stats-card';
import { useStats } from '@/features/stats/use-stats';
import { MonthHeader } from '@/features/timeline/month-header';
import { useTimeline } from '@/features/timeline/use-timeline';
import { VisitCard } from '@/features/visits/visit-card';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';
import { monthKey } from '@/lib/dates';

type Filter = 'all' | PersonId;
type Section = { month: string; data: TimelineVisit[] };

/** Groups newest-first visits into month sections, keeping their order. */
function groupByMonth(items: readonly TimelineVisit[]): Section[] {
  const sections: Section[] = [];
  for (const item of items) {
    const month = monthKey(item.visitDate);
    const last = sections.at(-1);
    if (last?.month === month) last.data.push(item);
    else sections.push({ month, data: [item] });
  }
  return sections;
}

export default function TimelineScreen() {
  const t = useT();
  const theme = useTheme();
  const { language } = useLanguage();
  const { people, byId } = usePeople();
  const [filter, setFilter] = useState<Filter>('all');
  const person = filter === 'all' ? null : filter;
  const { items, loading, error, hasMore, loadingMore, moreError, loadMore, retry } = useTimeline(person);
  const photosFor = usePhotosForVisits(items.map((item) => item.id));
  const sections = groupByMonth(items);
  const stats = useStats();

  const choices: Choice<Filter>[] = [
    { value: 'all', label: t('timeline.filterAll') },
    ...people.map((member) => ({ value: member.id, label: member.name })),
  ];

  const button = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { borderColor: theme.line }, pressed && styles.pressed]}>
      <ThemedText type="defaultBold">{label}</ThemedText>
    </Pressable>
  );

  const header = (
    <View style={styles.listHeader}>
      {stats ? <StatsCard stats={stats} people={people} /> : null}
      <ChoiceGroup label={t('timeline.filterLabel')} choices={choices} value={filter} onChange={setFilter} />
      {error && items.length > 0 ? (
        <View style={styles.inlineError}>
          <ThemedText themeColor="textSecondary">{t('timeline.loadFailed')}</ThemedText>
          {button(t('map.retry'), retry)}
        </View>
      ) : null}
    </View>
  );

  const empty = loading ? (
    <ActivityIndicator color={theme.accent} style={styles.spinner} />
  ) : error ? (
    <Postcard style={styles.message}>
      <ThemedText themeColor="textSecondary">{t('timeline.loadFailed')}</ThemedText>
      {button(t('map.retry'), retry)}
    </Postcard>
  ) : person ? (
    <Postcard style={styles.message}>
      <ThemedText themeColor="textSecondary">
        {t('timeline.noVisitsForPerson', { name: byId(person)?.name ?? '' })}
      </ThemedText>
    </Postcard>
  ) : (
    <EmptyState
      symbol={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }}
      title={t('timeline.emptyTitle')}
      body={t('timeline.emptyBody')}
      action={{
        label: t('empty.goToMap'),
        symbol: { ios: 'map', android: 'map', web: 'map' },
        onPress: () => router.navigate('/'),
      }}
    />
  );

  const footer = loadingMore ? (
    <ActivityIndicator color={theme.accent} style={styles.spinner} />
  ) : moreError ? (
    <View style={styles.footer}>
      <ThemedText themeColor="textSecondary">{t('timeline.loadFailed')}</ThemedText>
      {button(t('map.retry'), loadMore)}
    </View>
  ) : hasMore ? (
    <View style={styles.footer}>{button(t('timeline.loadMore'), loadMore)}</View>
  ) : undefined;

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t('timeline.title')} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => <MonthHeader month={section.month} />}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <VisitCard
              visit={item}
              people={people}
              placeName={(item.venue && venueNames(item.venue, language).primary) || t('place.unnamed')}
              linkPlace={item.venue !== null}
              photos={photosFor(item.id)}
            />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        // After a failed page, wait for an explicit retry instead of re-firing on every scroll.
        onEndReached={moreError ? undefined : loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingTop: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  listHeader: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  inlineError: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  item: {
    marginBottom: Spacing.three,
  },
  message: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  footer: {
    gap: Spacing.two,
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  spinner: {
    paddingVertical: Spacing.four,
  },
  button: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
