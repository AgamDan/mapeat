import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';

/** Contract stub — replaced by the visit-form agent. Params: `placeId`. */
export default function NewVisitScreen() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  return <ThemedText>{placeId}</ThemedText>;
}
