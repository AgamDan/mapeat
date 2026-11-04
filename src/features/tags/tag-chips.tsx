import { StyleSheet, View } from 'react-native';

import { UserText } from '@/components/user-text';
import { Radius, Spacing } from '@/constants/theme';
import type { Tag } from '@/data/journal';
import { useTheme } from '@/hooks/use-theme';

/** The couple's own tags as small read-only chips. Renders nothing for an empty list. */
export function TagChips({ tags }: { tags: readonly Tag[] }) {
  const theme = useTheme();
  if (tags.length === 0) return null;

  return (
    <View style={styles.row}>
      {tags.map((tag) => (
        <View key={tag.id} style={[styles.chip, { backgroundColor: theme.chip }]}>
          <UserText type="small" numberOfLines={1}>
            {tag.name}
          </UserText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    maxWidth: '100%',
  },
});
