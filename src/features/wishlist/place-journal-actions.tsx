import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { PlaceJournal } from '@/data/visits';
import { confirmRemoveMark, updateMark } from '@/features/wishlist/journal-marks';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

type Props = {
  placeId: string;
  /** Shown in the removal confirmation. */
  placeName: string;
  /** `null` while loading: nothing is offered until we know whether the place has visits. */
  journal: PlaceJournal | null;
};

/**
 * Place profile toggle: "Add to wishlist" while the place has no visits, "Want to go back" once
 * it has at least one. Turning either off asks first.
 */
export function PlaceJournalActions({ placeId, placeName, journal }: Props) {
  const db = useSQLiteContext();
  const t = useT();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  if (!journal) return null;

  const visited = journal.visits.length > 0;
  const mark = visited ? 'wantReturn' : 'wishlist';
  const on = visited ? !!journal.journalPlace?.wantReturn : !!journal.journalPlace?.wishlist;
  const label = visited
    ? t(on ? 'wantReturn.on' : 'wantReturn.add')
    : t(on ? 'wishlist.on' : 'wishlist.add');
  const icon: SymbolViewProps['name'] = visited
    ? { ios: on ? 'arrow.counterclockwise.circle.fill' : 'arrow.counterclockwise.circle', android: 'replay', web: 'replay' }
    : { ios: on ? 'heart.fill' : 'heart', android: on ? 'favorite' : 'favorite_border', web: on ? 'favorite' : 'favorite_border' };

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (on) await confirmRemoveMark(db, t, mark, placeId, placeName);
      else await updateMark(db, t, mark, placeId, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, busy }}
      accessibilityHint={on ? t(visited ? 'wantReturn.remove' : 'wishlist.remove') : undefined}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.accent, backgroundColor: on ? theme.chip : 'transparent' },
        (pressed || busy) && styles.pressed,
      ]}>
      <SymbolView name={icon} size={18} tintColor={theme.accent} />
      <ThemedText type="defaultBold" themeColor="accent">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
