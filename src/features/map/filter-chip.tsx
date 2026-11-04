import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FilterChipProps = {
  label: string;
  selected: boolean;
  /** `checkbox` for multi-select groups, `radio` for single choice. */
  role: 'checkbox' | 'radio';
  onPress: () => void;
};

/** A pill button in the filter sheet, styled like `ChoiceGroup` choices. */
export function FilterChip({ label, selected, role, onPress }: FilterChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: theme.card, borderColor: theme.line },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="defaultBold" style={{ color: selected ? theme.onAccent : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
