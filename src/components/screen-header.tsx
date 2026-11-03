import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

/**
 * Tab screen header: brand-colored title and a settings button at the end.
 * With `brand`, the title is shown next to the MapEat mark.
 */
export function ScreenHeader({
  title,
  floating = false,
  brand = false,
}: {
  title: string;
  floating?: boolean;
  brand?: boolean;
}) {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  // Over the map, title and button sit on small cards so they stay readable.
  const floatingSurface = floating ? [styles.floating, { backgroundColor: theme.card }] : null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
      <View style={[floatingSurface, brand && styles.brand]} accessibilityRole="header">
        {brand ? <BrandMark size={34} /> : null}
        <ThemedText type="title" themeColor="accent" style={styles.title}>
          {title}
        </ThemedText>
      </View>
      <Link href="/settings" asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.open')}
          hitSlop={8}
          style={({ pressed }) => [
            styles.gear,
            { backgroundColor: floating ? theme.card : theme.chip },
            floating && styles.shadow,
            pressed && styles.pressed,
          ]}>
          <SymbolView
            name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
            size={22}
            tintColor={theme.text}
          />
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: {
    flexShrink: 1,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  floating: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    shadowColor: '#503214',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  shadow: {
    shadowColor: '#503214',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  gear: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
