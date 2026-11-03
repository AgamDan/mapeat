import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Postcard } from '@/components/postcard';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type EmptyStateProps = {
  /** Drawn inside the big tilted "stamp" at the top of the card. */
  symbol: SymbolViewProps['name'];
  title: string;
  body: string;
  action?: { label: string; symbol?: SymbolViewProps['name']; onPress: () => void };
};

/** A warm, centered postcard for an empty list, with an illustrated stamp and one next step. */
export function EmptyState({ symbol, title, body, action }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <Postcard style={styles.card}>
      <View style={styles.illustration} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[styles.stamp, { backgroundColor: theme.sea, borderColor: theme.card }]}>
          <SymbolView name={symbol} size={34} tintColor={theme.card} />
        </View>
        <View style={[styles.postmark, { borderColor: theme.textSecondary }]} />
      </View>
      <ThemedText type="subtitle" style={styles.centered}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centered}>
        {body}
      </ThemedText>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
          {action.symbol ? <SymbolView name={action.symbol} size={16} tintColor={theme.onAccent} /> : null}
          <ThemedText type="defaultBold" style={{ color: theme.onAccent }}>
            {action.label}
          </ThemedText>
        </Pressable>
      ) : null}
    </Postcard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  illustration: {
    width: 120,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A faint round postmark over the stamp's corner, like on a mailed card.
  postmark: {
    position: 'absolute',
    top: 4,
    end: 0,
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  stamp: {
    width: 72,
    height: 84,
    borderWidth: 4,
    borderStyle: 'dotted',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-5deg' }],
  },
  centered: {
    textAlign: 'center',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.7,
  },
});
