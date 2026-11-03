import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert } from 'react-native';

import { setWantReturn, setWishlist } from '@/data/journal';
import type { useT } from '@/i18n/i18n';

type Translate = ReturnType<typeof useT>;

function reportFailure(t: Translate) {
  Alert.alert(t('journal.updateFailed'));
}

/** Writes a wishlist / "want to go back" change; shows a translated alert if it fails. */
export async function updateMark(
  db: SQLiteDatabase,
  t: Translate,
  mark: 'wishlist' | 'wantReturn',
  placeId: string,
  on: boolean,
) {
  try {
    await (mark === 'wishlist' ? setWishlist(db, placeId, on) : setWantReturn(db, placeId, on));
    return true;
  } catch {
    reportFailure(t);
    return false;
  }
}

/**
 * Asks before taking a place off the wishlist or clearing its "want to go back" mark, then
 * writes it. Resolves `true` only if the change was confirmed and saved.
 */
export function confirmRemoveMark(
  db: SQLiteDatabase,
  t: Translate,
  mark: 'wishlist' | 'wantReturn',
  placeId: string,
  placeName: string,
) {
  return new Promise<boolean>((resolve) => {
    const title = mark === 'wishlist' ? t('wishlist.remove') : t('wantReturn.remove');
    const message =
      mark === 'wishlist'
        ? t('wishlist.removeConfirm', { name: placeName })
        : t('wantReturn.removeConfirm', { name: placeName });
    Alert.alert(
      title,
      message,
      [
        { text: t('visit.cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => {
            updateMark(db, t, mark, placeId, false).then(resolve);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
