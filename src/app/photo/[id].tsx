import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';

/** Contract stub — replaced by the visit-photos agent. Full-screen viewer for one photo (`id`). */
export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ThemedText>{id}</ThemedText>;
}
