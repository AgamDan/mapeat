import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

type FilterButtonProps = {
  /** Number of active filter groups; shown as a badge when above zero. */
  activeCount: number;
  onPress: () => void;
};

/** Round map button that opens the filter sheet. */
export function FilterButton({ activeCount, onPress }: FilterButtonProps) {
  const theme = useTheme();
  const t = useT();
  const label =
    activeCount > 0
      ? `${t('filters.open')}, ${t('filters.activeCount', { count: activeCount })}`
      : t('filters.open');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.card }, pressed && styles.pressed]}>
      <SymbolView
        name={{ ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' }}
        size={20}
        tintColor={activeCount > 0 ? theme.accent : theme.text}
      />
      {activeCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: theme.accent, borderColor: theme.card }]}>
          <ThemedText type="small" style={[styles.badgeText, { color: theme.onAccent }]}>
            {activeCount}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 46,
    height: 46,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#503214',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  badge: {
    position: 'absolute',
    top: -2,
    end: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.7,
  },
});
