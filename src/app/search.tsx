import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import type { MapPlace } from '@/data/journal';
import { requestMapFocus } from '@/features/map/map-focus-store';
import { SearchResultRow } from '@/features/search/search-result-row';
import { usePlaceSearch } from '@/features/search/use-place-search';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';

type Item = { type: 'ours' } | { type: 'place'; place: MapPlace };

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** The first catalog place after the journal places starts a new group. */
function startsCatalogGroup(items: Item[], index: number) {
  const item = items[index];
  const previous = items[index - 1];
  return (
    item?.type === 'place' &&
    previous?.type === 'place' &&
    item.place.status === 'none' &&
    previous.place.status !== 'none'
  );
}

/** Search places by name; picking one flies the map there and opens it. */
export default function SearchScreen() {
  const t = useT();
  const theme = useTheme();
  const { direction } = useLanguage();
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const search = usePlaceSearch(query, attempt);

  const results = search.state === 'done' || search.state === 'searching' ? search.results : null;
  // Journal places come first; label that group once.
  const items: Item[] = [];
  if (results?.[0] && results[0].status !== 'none') items.push({ type: 'ours' });
  for (const place of results ?? []) items.push({ type: 'place', place });

  const choose = (place: MapPlace) => {
    Keyboard.dismiss();
    requestMapFocus({ placeId: place.id, latitude: place.lat, longitude: place.lon });
    close();
  };

  let message: string | null = null;
  if (search.state === 'idle') message = t('search.hint');
  else if (search.state === 'error') message = t('search.failed');
  else if (search.state === 'done' && search.results.length === 0) {
    message = t('search.noResults', { query: query.trim() });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          placeholder={t('search.placeholder')}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={t('search.title')}
          selectionColor={theme.accent}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          maxLength={80}
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.backgroundRaised,
              borderColor: theme.line,
              writingDirection: direction,
            },
          ]}
        />
        {search.state === 'searching' ? <ActivityIndicator size="small" color={theme.accent} /> : null}
      </View>

      {message ? (
        <View style={styles.message}>
          <ThemedText themeColor="textSecondary" style={styles.messageText}>
            {message}
          </ThemedText>
          {search.state === 'error' ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setAttempt((n) => n + 1)}>
              <ThemedText type="smallBold" themeColor="accent">
                {t('map.retry')}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => (item.type === 'ours' ? 'ours' : item.place.id)}
          renderItem={({ item, index }) =>
            item.type === 'ours' ? (
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('search.ours')}
              </ThemedText>
            ) : (
              <View style={startsCatalogGroup(items, index) ? styles.groupGap : null}>
                <SearchResultRow place={item.place} onPress={choose} />
              </View>
            )
          }
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 17,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
  groupGap: {
    marginTop: Spacing.three,
  },
  message: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  messageText: {
    textAlign: 'center',
  },
});
