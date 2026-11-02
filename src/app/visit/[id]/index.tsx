import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';

/** Contract stub — replaced by the visit-history agent. Params: `id` (visit id). */
export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ThemedText>{id}</ThemedText>;
}
