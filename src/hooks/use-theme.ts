import { useColorScheme } from 'react-native';

import { Colors, type ColorScheme } from '@/constants/theme';
import { useSettings } from '@/settings/settings-provider';

/** Resolved light/dark scheme: the manual choice in settings, otherwise the phone's. */
export function useResolvedScheme(): ColorScheme {
  const { appearance } = useSettings();
  const system = useColorScheme();
  if (appearance !== 'system') return appearance;
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  return Colors[useResolvedScheme()];
}
