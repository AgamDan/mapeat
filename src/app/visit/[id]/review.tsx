import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';

/** Contract stub — replaced by the visit-form agent. Params: `id` (visit id), `author` (`a` | `b`). */
export default function ReviewScreen() {
  const { id, author } = useLocalSearchParams<{ id: string; author: string }>();
  return <ThemedText>{`${id} ${author}`}</ThemedText>;
}
