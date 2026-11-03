import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import type { MapPlace } from '@/data/journal';
import { addressLine, cuisineLabels, KIND_LABEL_KEYS, venueNames } from '@/features/catalog/labels';
import { useTheme } from '@/hooks/use-theme';
import type { TranslationKey } from '@/i18n/en';
import { useLanguage, useT } from '@/i18n/i18n';

type Badge = { key: TranslationKey; color: ThemeColor };

function journalBadges(place: MapPlace): Badge[] {
  if (place.status === 'visited') {
    const badges: Badge[] = [{ key: 'filters.showVisited', color: 'accent' }];
    if (place.wantReturn) badges.push({ key: 'wantReturn.on', color: 'personB' });
    return badges;
  }
  if (place.status === 'wishlist') return [{ key: 'wishlist.on', color: 'sea' }];
  return [];
}

/** One search result: names, kind and cuisine, address, and journal badges. */
export function SearchResultRow({ place, onPress }: { place: MapPlace; onPress: (place: MapPlace) => void }) {
  const t = useT();
  const theme = useTheme();
  const { language } = useLanguage();
  const kindLabel = t(KIND_LABEL_KEYS[place.kind]);
  const { primary, secondary } = venueNames(place, language);
  const name = primary ?? kindLabel;
  const details = [kindLabel, ...cuisineLabels(place.cuisine, language)].join(' · ');
  const address = addressLine(place);
  const badges = journalBadges(place);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, ...badges.map((badge) => t(badge.key)), details, address]
        .filter(Boolean)
        .join(', ')}
      onPress={() => onPress(place)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.card, borderColor: theme.line },
        pressed && styles.pressed,
      ]}>
      <View style={styles.text}>
        <ThemedText type="defaultBold" numberOfLines={1}>
          {name}
        </ThemedText>
        {secondary ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {secondary}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {details}
        </ThemedText>
        {address ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {address}
          </ThemedText>
        ) : null}
        {badges.length > 0 ? (
          <View style={styles.badges}>
            {badges.map((badge) => (
              <View key={badge.key} style={[styles.badge, { backgroundColor: theme.chip }]}>
                <ThemedText type="smallBold" style={{ color: theme[badge.color] }}>
                  {t(badge.key)}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <SymbolView
        name={{ ios: 'mappin.and.ellipse', android: 'place', web: 'place' }}
        size={18}
        tintColor={theme.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.7,
  },
});
