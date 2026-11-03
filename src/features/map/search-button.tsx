import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

/** Round map button that opens place search. */
export function SearchButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const t = useT();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('search.open')}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.card }, pressed && styles.pressed]}>
      <SymbolView
        name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
        size={20}
        tintColor={theme.text}
      />
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
  pressed: {
    opacity: 0.7,
  },
});
