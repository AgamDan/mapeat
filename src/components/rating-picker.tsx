import type { ReactNode } from 'react';
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
  /** `compact`: smaller numbers and tighter spacing (still 44 pt tall), for secondary ratings. */
  size?: 'regular' | 'compact';
  /** Shown at the end of the label row (e.g. a "Clear" button). */
  accessory?: ReactNode;
};

/** A 1–10 whole-number rating as two rows of five buttons (radio group); compact is a smaller variant. */
export function RatingPicker({
  label,
  value,
  onChange,
  color,
  disabled = false,
  invalid = false,
  size = 'regular',
  accessory,
}: RatingPickerProps) {
  const theme = useTheme();
  const fill = color ?? theme.accent;
  const compact = size === 'compact';

  return (
    <View style={compact ? styles.compactGroup : styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <View style={styles.labelRow}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
          {label}
        </ThemedText>
        {accessory}
      </View>
      {ROWS.map((row) => (
        <View key={row[0]} style={compact ? styles.compactRow : styles.row}>
          {row.map((rating) => {
            const selected = rating === value;
            return (
              <Pressable
                key={rating}
                accessibilityRole="radio"
                accessibilityLabel={compact ? `${label} ${rating}` : String(rating)}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => onChange(rating)}
                style={({ pressed }) => [
                  styles.cell,
                  compact && styles.compactCell,
                  selected
                    ? { backgroundColor: fill, borderColor: fill }
                    : { backgroundColor: theme.card, borderColor: invalid ? theme.accent : theme.line },
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  style={[compact ? styles.compactNumber : styles.number, { color: selected ? theme.onAccent : theme.text }]}>
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
  compactGroup: {
    gap: Spacing.one,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  label: {
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  compactRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  cell: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  compactCell: {
    minHeight: 44,
  },
  number: {
    fontFamily: Fonts.display,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
  },
  compactNumber: {
    fontFamily: Fonts.display,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
