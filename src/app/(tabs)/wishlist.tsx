import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import type { ListedPlace } from '@/data/journal';
import { EmptyState } from '@/features/empty/empty-state';
import { useWishlist } from '@/features/wishlist/use-wishlist';
import { WishlistRow } from '@/features/wishlist/wishlist-row';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

type Section = { key: 'wishlist' | 'wantReturn'; title: string; data: ListedPlace[] };

export default function WishlistScreen() {
  const t = useT();
  const theme = useTheme();
  const { lists, error, retry } = useWishlist();

  const retryButton = (
    <Pressable
      accessibilityRole="button"
      onPress={retry}
      style={({ pressed }) => [styles.retry, { borderColor: theme.line }, pressed && styles.pressed]}>
      <ThemedText type="defaultBold">{t('map.retry')}</ThemedText>
    </Pressable>
  );

  let body;
  if (!lists) {
    body = error ? (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary">{t('wishlist.loadFailed')}</ThemedText>
        {retryButton}
      </View>
    ) : (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  } else {
    const sections: Section[] = [
      { key: 'wishlist' as const, title: t('wishlist.wantToTry'), data: lists.wantToTry },
      { key: 'wantReturn' as const, title: t('wishlist.wantToGoBack'), data: lists.wantToGoBack },
    ].filter((section) => section.data.length > 0);

    body = (
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.placeId}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          error ? (
            <View style={styles.staleNotice}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('wishlist.loadFailed')}
              </ThemedText>
              {retryButton}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            symbol={{ ios: 'heart', android: 'favorite', web: 'favorite' }}
            title={t('wishlist.emptyTitle')}
            body={t('wishlist.emptyBody')}
            action={{
              label: t('empty.goToMap'),
              symbol: { ios: 'map', android: 'map', web: 'map' },
              onPress: () => router.navigate('/'),
            }}
          />
        }
        renderSectionHeader={({ section }) => (
          <ThemedText type="subtitle" accessibilityRole="header" style={styles.sectionHeader}>
            {`${section.title} · ${section.data.length}`}
          </ThemedText>
        )}
        renderItem={({ item, section }) => <WishlistRow place={item} mark={section.key} />}
        ItemSeparatorComponent={Separator}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t('wishlist.title')} />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/add-from-link')}
        style={({ pressed }) => [
          styles.linkButton,
          { borderColor: theme.accent, backgroundColor: theme.card },
          pressed && styles.pressed,
        ]}>
        <SymbolView name={{ ios: 'link', android: 'link', web: 'link' }} size={16} tintColor={theme.accent} />
        <ThemedText type="defaultBold" themeColor="accent">
          {t('link.open')}
        </ThemedText>
      </Pressable>
      {body}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  sectionHeader: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  separator: {
    height: Spacing.two,
  },
  staleNotice: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  retry: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
});
