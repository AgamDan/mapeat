import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';

/**
 * Contract stub — replaced by the wishlist agent. With `placeId`: choose that place's tags.
 * Without: manage all tags (rename / delete).
 */
export default function TagsScreen() {
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  return <ThemedText>{placeId ?? ''}</ThemedText>;
}
