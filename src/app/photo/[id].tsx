import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useJournalRevision } from '@/data/journal-events';
import {
  deletePhoto,
  getCoverPhoto,
  getMenuPhotos,
  getPhoto,
  getVisitPhotos,
  setCoverPhoto,
  type Photo,
} from '@/data/photos';
import { usePeople } from '@/features/people/use-people';
import { photoUri } from '@/features/photos/photo-files';
import { useResolvedScheme } from '@/hooks/use-theme';
import type { TranslationKey } from '@/i18n/en';
import { useLanguage, useT } from '@/i18n/i18n';
import { formatVisitDate, fromPickerDate } from '@/lib/dates';
import type { Language } from '@/settings/settings-provider';

// Photos are viewed on a dark surface in both appearances, like the iPhone Photos app.
const palette = Colors.dark;

type Loaded =
  | { id: string; photos: null }
  | { id: string; photos: Photo[]; coverId: string | null };

/**
 * The opened photo together with its siblings (the same visit's photos, or the place's menu
 * photos) and the place's cover, re-queried after every journal write.
 */
function usePhotoSet(id: string | undefined) {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      let result: Loaded;
      try {
        const photo = await getPhoto(db, id);
        if (!photo) {
          result = { id, photos: null };
        } else {
          const [siblings, cover] = await Promise.all([
            photo.visitId ? getVisitPhotos(db, photo.visitId) : getMenuPhotos(db, photo.placeId),
            getCoverPhoto(db, photo.placeId).catch(() => null),
          ]);
          const photos = siblings.some((sibling) => sibling.id === id) ? siblings : [photo];
          result = { id, photos, coverId: cover?.id ?? null };
        }
      } catch {
        result = { id, photos: null };
      }
      if (!cancelled) setLoaded(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, id, revision]);

  return loaded && loaded.id === id ? loaded : undefined;
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** When the photo was taken (else added), as the phone's local calendar date. */
function photoDate(photo: Photo, language: Language) {
  return formatVisitDate(fromPickerDate(new Date(photo.takenAt ?? photo.createdAt)), language, 'long');
}

export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const t = useT();
  const scheme = useResolvedScheme();
  const { language } = useLanguage();
  const { byId } = usePeople();
  const insets = useSafeAreaInsets();
  const loaded = usePhotoSet(id);
  const [currentId, setCurrentId] = useState(id);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // Set while this screen deletes the photo, so it closes instead of flashing "not found".
  const [closing, setClosing] = useState(false);

  const alertOptions = { userInterfaceStyle: scheme } as const;
  const photos = loaded?.photos ?? null;
  const current = photos ? (photos.find((photo) => photo.id === currentId) ?? null) : null;
  const coverId = loaded && loaded.photos ? loaded.coverId : null;

  const run = async (action: () => Promise<void>, failureKey: TranslationKey) => {
    setBusy(true);
    try {
      await action();
    } catch {
      Alert.alert(t(failureKey), undefined, undefined, alertOptions);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (photo: Photo) => {
    Alert.alert(
      t('photos.delete'),
      t('photos.deleteConfirm'),
      [
        { text: t('visit.cancel'), style: 'cancel' },
        {
          text: t('visit.delete'),
          style: 'destructive',
          onPress: () =>
            run(async () => {
              setClosing(true);
              try {
                await deletePhoto(db, photo.id);
                close();
              } catch (error) {
                setClosing(false);
                throw error;
              }
            }, 'photos.deleteFailed'),
        },
      ],
      alertOptions,
    );
  };

  const toggleCover = (photo: Photo) =>
    run(
      () => setCoverPhoto(db, photo.placeId, coverId === photo.id ? null : photo.id),
      'photos.coverFailed',
    );

  let body: ReactNode;
  if (closing) {
    body = null;
  } else if (loaded === undefined) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  } else if (!photos || !current) {
    body = (
      <View style={styles.center}>
        <ThemedText style={{ color: palette.textSecondary }}>{t('photos.notFound')}</ThemedText>
      </View>
    );
  } else {
    const initialIndex = Math.max(
      0,
      photos.findIndex((photo) => photo.id === id),
    );
    body = (
      <>
        <View
          style={styles.pager}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            const size = { width: Math.round(width), height: Math.round(height) };
            // Only real size changes re-render; repeated layout passes with the same size are ignored.
            setFrame((previous) =>
              previous && previous.width === size.width && previous.height === size.height ? previous : size,
            );
          }}>
          {frame ? (
            <FlatList
              data={photos}
              keyExtractor={(photo) => photo.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, index) => ({ length: frame.width, offset: frame.width * index, index })}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / frame.width);
                const photo = photos[Math.min(photos.length - 1, Math.max(0, index))];
                if (photo) setCurrentId(photo.id);
              }}
              // Paging math assumes left-to-right offsets; photos keep their order in both languages.
              style={styles.ltr}
              renderItem={({ item }) => (
                <ScrollView
                  style={{ width: frame.width, height: frame.height }}
                  contentContainerStyle={{ width: frame.width, height: frame.height }}
                  maximumZoomScale={4}
                  minimumZoomScale={1}
                  bouncesZoom
                  centerContent
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}>
                  <Image
                    source={{ uri: photoUri(item.fileName) }}
                    style={styles.image}
                    contentFit="contain"
                    recyclingKey={item.id}
                    transition={150}
                    accessibilityIgnoresInvertColors
                  />
                </ScrollView>
              )}
            />
          ) : null}
        </View>
        <PhotoDetails
          photo={current}
          index={photos.indexOf(current)}
          total={photos.length}
          addedBy={byId(current.addedBy)?.name ?? null}
          date={photoDate(current, language)}
          isCover={coverId === current.id}
          busy={busy}
          bottomInset={insets.bottom}
          onToggleCover={() => toggleCover(current)}
          onDelete={() => confirmDelete(current)}
        />
      </>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <StatusBar style="light" />
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('place.close')}
          hitSlop={8}
          onPress={close}
          style={({ pressed }) => [styles.closeButton, { backgroundColor: palette.chip }, pressed && styles.pressed]}>
          <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={16} tintColor={palette.text} />
        </Pressable>
      </View>
      {body}
    </View>
  );
}

type PhotoDetailsProps = {
  photo: Photo;
  index: number;
  total: number;
  addedBy: string | null;
  date: string;
  isCover: boolean;
  busy: boolean;
  bottomInset: number;
  onToggleCover: () => void;
  onDelete: () => void;
};

function PhotoDetails({
  photo,
  index,
  total,
  addedBy,
  date,
  isCover,
  busy,
  bottomInset,
  onToggleCover,
  onDelete,
}: PhotoDetailsProps) {
  const t = useT();
  const canBeCover = photo.kind === 'visit';

  return (
    <View
      style={[
        styles.details,
        { paddingBottom: bottomInset + Spacing.three, borderTopColor: palette.line },
      ]}>
      <View style={styles.meta}>
        <View style={styles.metaText}>
          {addedBy ? (
            <ThemedText type="smallBold" style={{ color: palette.text }}>
              {t('photos.addedBy', { name: addedBy })}
            </ThemedText>
          ) : null}
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            {date}
          </ThemedText>
        </View>
        {total > 1 ? (
          <ThemedText type="smallBold" style={[styles.ltrText, { color: palette.textSecondary }]}>
            {`${index + 1}/${total}`}
          </ThemedText>
        ) : null}
      </View>

      {canBeCover && isCover ? (
        <View style={[styles.coverNote, { backgroundColor: palette.chip }]}>
          <ThemedText type="smallBold" style={{ color: palette.sea }}>
            {t('photos.isCover')}
          </ThemedText>
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            {t('photos.coverHint')}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.actions}>
        {canBeCover ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, selected: isCover }}
            disabled={busy}
            onPress={onToggleCover}
            style={({ pressed }) => [
              styles.button,
              styles.coverButton,
              isCover
                ? { borderColor: palette.line }
                : { borderColor: palette.accent, backgroundColor: palette.accent },
              (pressed || busy) && styles.pressed,
            ]}>
            <SymbolView
              name={{ ios: isCover ? 'star.slash' : 'star.fill', android: 'star', web: 'star' }}
              size={16}
              tintColor={isCover ? palette.text : palette.onAccent}
            />
            <ThemedText type="smallBold" style={{ color: isCover ? palette.text : palette.onAccent }}>
              {isCover ? t('photos.removeCover') : t('photos.setCover')}
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onDelete}
          style={({ pressed }) => [
            styles.button,
            { borderColor: palette.accent },
            (pressed || busy) && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={{ color: palette.accent }}>
            {t('photos.delete')}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  topBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pager: {
    flex: 1,
  },
  ltr: {
    direction: 'ltr',
  },
  ltrText: {
    writingDirection: 'ltr',
  },
  image: {
    flex: 1,
  },
  details: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  metaText: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  coverNote: {
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: Spacing.half,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  coverButton: {
    flex: 2,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
