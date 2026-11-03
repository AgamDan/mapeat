import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { type ComponentRef, useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import type { Person } from '@/data/people';
import { getVisitPhotos, type Photo } from '@/data/photos';
import type { Visit } from '@/data/visits';
import { VisitShareCard } from '@/features/share/visit-share-card';
import { useResolvedScheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

const MAX_SHARED_PHOTOS = 3;
/** Don't wait forever for a photo that never reports back. */
const IMAGE_TIMEOUT_MS = 5000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

type ShareVisitInput = { visit: Visit; people: Person[]; placeName: string };
type ShareJob = ShareVisitInput & { photos: Photo[] };

/**
 * Shares a visit as a postcard image via `share({ visit, people, placeName })`. `card` must be
 * rendered by the screen *underneath* its opaque content: while sharing, the card is really laid
 * out and drawn (so it can be captured) but stays hidden.
 */
export function useShareVisit() {
  const db = useSQLiteContext();
  const t = useT();
  const scheme = useResolvedScheme();
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const readyRef = useRef<(() => void) | null>(null);
  const [sharing, setSharing] = useState(false);
  const [job, setJob] = useState<ShareJob | null>(null);

  const onReady = useCallback(() => readyRef.current?.(), []);

  const share = async (input: ShareVisitInput) => {
    if (sharing) return;
    const alertOptions = { userInterfaceStyle: scheme } as const;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t('share.unavailable'), undefined, undefined, alertOptions);
        return;
      }
      const visitPhotos = await getVisitPhotos(db, input.visit.id).catch((): Photo[] => []);
      const ready = new Promise<void>((resolve) => {
        readyRef.current = resolve;
      });
      setJob({ ...input, photos: visitPhotos.slice(0, MAX_SHARED_PHOTOS) });
      await Promise.race([ready, delay(IMAGE_TIMEOUT_MS)]);
      // Let the native views draw their last frame (fonts, decoded images) before capturing.
      await nextFrame();
      await nextFrame();
      const uri = await captureRef(cardRef, { format: 'png', result: 'tmpfile' });
      try {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: t('share.button'),
        });
      } finally {
        releaseCapture(uri);
      }
    } catch {
      Alert.alert(t('share.failed'), undefined, undefined, alertOptions);
    } finally {
      readyRef.current = null;
      setJob(null);
      setSharing(false);
    }
  };

  const card = job ? (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.stage}>
      <VisitShareCard
        ref={cardRef}
        visit={job.visit}
        people={job.people}
        placeName={job.placeName}
        photos={job.photos}
        onReady={onReady}
      />
    </View>
  ) : null;

  return { share, sharing, card };
}

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    top: 0,
    start: 0,
  },
});
