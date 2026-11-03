import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { TagChips } from '@/features/tags/tag-chips';
import { usePlaceTags } from '@/features/tags/use-tags';
import { useT } from '@/i18n/i18n';

/** Place profile: the place's own tags plus an "Edit tags" link to the tag chooser. */
export function PlaceTagsRow({ placeId }: { placeId: string }) {
  const t = useT();
  const { tags, error, retry } = usePlaceTags(placeId);

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
          {t('tags.title')}
        </ThemedText>
        <Pressable
          accessibilityRole="link"
          hitSlop={Spacing.two}
          onPress={() => router.push({ pathname: '/tags', params: { placeId } })}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="smallBold" themeColor="accent">
            {t('tags.edit')}
          </ThemedText>
        </Pressable>
      </View>
      {tags ? (
        tags.length > 0 ? (
          <TagChips tags={tags} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t('tags.none')}
          </ThemedText>
        )
      ) : error ? (
        <Pressable accessibilityRole="button" onPress={retry} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="small" themeColor="accent">
            {t('map.retry')}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  label: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
