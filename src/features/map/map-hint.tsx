import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

const STORAGE_KEY = 'mapeat.mapHint.v1';

/** Whether the first-use map hint should show; `dismiss` hides it for good. */
function useMapHint() {
  // Hidden until storage answers, so it never flashes for people who already dismissed it.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (active && value === null) setVisible(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(STORAGE_KEY, 'dismissed').catch(() => {});
  };

  return { visible, dismiss };
}

/** A small first-use card on the map, shown until dismissed once. */
export function MapHint() {
  const theme = useTheme();
  const t = useT();
  const { visible, dismiss } = useMapHint();
  if (!visible) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.text}>
        <ThemedText type="smallBold">{t('mapHint.title')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('mapHint.body')}
        </ThemedText>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={dismiss}
        hitSlop={8}
        style={({ pressed }) => [styles.dismiss, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
        <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
          {t('mapHint.dismiss')}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    width: '92%',
    maxWidth: 420,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
    shadowColor: '#503214',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  dismiss: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.7,
  },
});
