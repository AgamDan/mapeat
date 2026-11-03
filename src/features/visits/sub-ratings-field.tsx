import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RatingPicker } from '@/components/rating-picker';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SUB_RATING_KEYS, type SubRatings } from '@/data/visits';
import { hasSubRatings, SUB_RATING_LABELS } from '@/features/visits/sub-ratings';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

type SubRatingsFieldProps = {
  value: SubRatings;
  onChange: (sub: SubRatings) => void;
  /** Ink of the review's author, used for the chosen numbers. */
  color: string;
  disabled?: boolean;
};

/**
 * Optional Food / Service / Vibe ratings, folded away under one button. Starts open when the draft
 * already has any of them, so nothing set is hidden.
 */
export function SubRatingsField({ value, onChange, color, disabled = false }: SubRatingsFieldProps) {
  const theme = useTheme();
  const t = useT();
  const [open, setOpen] = useState(() => hasSubRatings(value));

  return (
    <View style={styles.box}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('review.extraRatings')}
        accessibilityState={{ expanded: open }}
        hitSlop={Spacing.two}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.toggleText}>
          {t('review.extraRatings')}
        </ThemedText>
        <SymbolView
          name={
            open
              ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
              : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
          }
          size={14}
          tintColor={theme.textSecondary}
        />
      </Pressable>

      {open
        ? SUB_RATING_KEYS.map((key) => {
            const label = t(SUB_RATING_LABELS[key]);
            const current = value[key];
            return (
              <RatingPicker
                key={key}
                size="compact"
                label={label}
                value={current}
                color={color}
                disabled={disabled}
                onChange={(rating) => onChange({ ...value, [key]: rating })}
                accessory={
                  current !== null ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t('review.extraClear')}: ${label}`}
                      accessibilityState={{ disabled }}
                      disabled={disabled}
                      hitSlop={Spacing.two}
                      onPress={() => onChange({ ...value, [key]: null })}
                      style={({ pressed }) => pressed && styles.pressed}>
                      <ThemedText type="smallBold" style={{ color }}>
                        {t('review.extraClear')}
                      </ThemedText>
                    </Pressable>
                  ) : null
                }
              />
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.three,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 32,
  },
  toggleText: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
