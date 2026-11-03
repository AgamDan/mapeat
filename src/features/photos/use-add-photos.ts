import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { MAX_PHOTOS_PER_VISIT, PhotoLimitError } from '@/data/photos';
import { addPickedPhotos, pickPhotos, type AddTarget, type PhotoSource } from '@/features/photos/add-photos';
import { useResolvedScheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';
import { useSettings } from '@/settings/settings-provider';

/**
 * "Add photos" flow for a visit or a place's menu: asks camera or library, picks, resizes, stores,
 * and records the photos as the current "Writing as" person. Shows translated alerts for denied
 * camera access, a full visit, or failed images. `remaining` limits library multi-select.
 */
export function useAddPhotos(targetProp: Omit<AddTarget, 'addedBy'> | null, remainingProp: number) {
  const db = useSQLiteContext();
  const t = useT();
  const scheme = useResolvedScheme();
  const { writer } = useSettings();
  const [adding, setAdding] = useState(false);
  const busy = useRef(false);

  const run = useCallback(
    async (source: PhotoSource, target: Omit<AddTarget, 'addedBy'>, remaining: number) => {
      if (busy.current) return;
      busy.current = true;
      const alertOptions = { userInterfaceStyle: scheme } as const;
      try {
        const picked = await pickPhotos(source, remaining);
        if (picked.status === 'denied') {
          Alert.alert(t('photos.cameraDenied'), undefined, undefined, alertOptions);
          return;
        }
        if (picked.status !== 'picked') return;
        setAdding(true);
        const result = await addPickedPhotos(db, picked.assets, { ...target, addedBy: writer });
        if (result.error instanceof PhotoLimitError) {
          Alert.alert(t('photos.limitReached', { max: MAX_PHOTOS_PER_VISIT }), undefined, undefined, alertOptions);
        } else if (result.failed > 0) {
          Alert.alert(
            result.added.length === 0 ? t('photos.addFailed') : t('photos.someFailed', { count: result.failed }),
            undefined,
            undefined,
            alertOptions,
          );
        }
      } catch {
        Alert.alert(t('photos.addFailed'), undefined, undefined, alertOptions);
      } finally {
        busy.current = false;
        setAdding(false);
      }
    },
    [db, scheme, t, writer],
  );

  /**
   * Asks "Take photo / Choose from library", then runs the flow. Pass `to` to add to a target
   * chosen at tap time (e.g. a visit picked on the place page) instead of the hook's own.
   */
  const add = useCallback((to?: { target: Omit<AddTarget, 'addedBy'>; remaining: number }) => {
    const target = to?.target ?? targetProp;
    const remaining = to?.remaining ?? remainingProp;
    if (!target || busy.current) return;
    if (remaining <= 0 && target.kind === 'visit') {
      Alert.alert(t('photos.limitReached', { max: MAX_PHOTOS_PER_VISIT }), undefined, undefined, {
        userInterfaceStyle: scheme,
      });
      return;
    }
    Alert.alert(
      target.kind === 'menu' ? t('photos.addMenu') : t('photos.add'),
      undefined,
      [
        { text: t('photos.takePhoto'), onPress: () => void run('camera', target, remaining) },
        { text: t('photos.chooseFromLibrary'), onPress: () => void run('library', target, remaining) },
        { text: t('visit.cancel'), style: 'cancel' },
      ],
      { userInterfaceStyle: scheme },
    );
  }, [remainingProp, run, scheme, t, targetProp]);

  return { add, adding };
}
