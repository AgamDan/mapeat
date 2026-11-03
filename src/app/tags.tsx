import { useLocalSearchParams } from 'expo-router';

import { TagEditor } from '@/features/tags/tag-editor';

/** With `placeId`: choose that place's tags. Without: manage all tags (rename / delete). */
export default function TagsScreen() {
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  return <TagEditor placeId={placeId || undefined} />;
}
