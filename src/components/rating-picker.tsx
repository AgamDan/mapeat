import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ROWS = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
] as const;

type RatingPickerProps = {
  label: string;
  /** Whole number 1–10, or `null` when nothing is chosen yet (there is no default). */
  value: number | null;
  onChange: (value: number) => void;
  /** Fill color of the chosen number; defaults to the accent. */
  color?: string;
  disabled?: boolean;
  /** Highlights the outline, e.g. after trying to save without a rating. */
  invalid?: boolean;
};

/** A 1–10 whole-number rating as two rows of five large buttons (radio group). */
export function RatingPicker({ label, value, onChange, color, disabled = false, invalid = false }: RatingPickerProps) {
  const theme = useTheme();
  const fill = color ?? theme.accent;

  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      {ROWS.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((rating) => {
            const selected = rating === value;
            return (
              <Pressable
                key={rating}
                accessibilityRole="radio"
                accessibilityLabel={String(rating)}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => onChange(rating)}
                style={({ pressed }) => [
                  styles.cell,
                  selected
                    ? { backgroundColor: fill, borderColor: fill }
                    : { backgroundColor: theme.card, borderColor: invalid ? theme.accent : theme.line },
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={[styles.number, { color: selected ? theme.onAccent : theme.text }]}>
                  {rating}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cell: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  number: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
