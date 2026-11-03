import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { MAX_PHOTOS_PER_VISIT } from '@/data/photos';
import { PhotoGrid } from '@/features/photos/photo-grid';
import { useAddPhotos } from '@/features/photos/use-add-photos';
import { useVisitPhotos } from '@/features/photos/use-visit-photos';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

/** "Our photos" on the visit screen: the visit's photos, a count out of the limit, and "Add photos". */
export function VisitPhotosSection({ placeId, visitId }: { placeId: string; visitId: string }) {
  const theme = useTheme();
  const t = useT();
  const photos = useVisitPhotos(visitId);
  const count = photos?.length ?? 0;
  const remaining = Math.max(0, MAX_PHOTOS_PER_VISIT - count);
  const { add, adding } = useAddPhotos({ kind: 'visit', placeId, visitId }, remaining);
  const full = remaining === 0;
  const web = Platform.OS === 'web';
  const disabled = photos === undefined || adding || full;

  return (
    <View style={[styles.panel, { borderColor: theme.line, backgroundColor: theme.backgroundRaised }]}>
      <View style={styles.heading}>
        <ThemedText type="subtitle" style={styles.title}>
          {t('photos.ourPhotos')}
        </ThemedText>
        {photos !== undefined ? (
          <ThemedText
            type="smallBold"
            themeColor="textSecondary"
            style={styles.count}
            accessibilityLabel={`${count} / ${MAX_PHOTOS_PER_VISIT}`}>
            {`${count}/${MAX_PHOTOS_PER_VISIT}`}
          </ThemedText>
        ) : null}
      </View>

      {photos === undefined ? (
        <ActivityIndicator color={theme.accent} style={styles.loading} />
      ) : photos.length > 0 ? (
        <PhotoGrid photos={photos} />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('photos.empty')}
        </ThemedText>
      )}

      {web ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('photos.webUnavailable')}
        </ThemedText>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled, busy: adding }}
            disabled={disabled}
            onPress={() => add()}
            style={({ pressed }) => [
              styles.button,
              { borderColor: theme.accent },
              (pressed || disabled) && styles.pressed,
            ]}>
            {adding ? <ActivityIndicator color={theme.accent} /> : null}
            <ThemedText type="defaultBold" themeColor="accent">
              {adding ? t('photos.adding') : t('photos.add')}
            </ThemedText>
          </Pressable>
          {full ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('photos.limitReached', { max: MAX_PHOTOS_PER_VISIT })}
            </ThemedText>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flexShrink: 1,
  },
  // Keeps "3/10" from being reordered inside Hebrew text.
  count: {
    writingDirection: 'ltr',
  },
  loading: {
    alignSelf: 'flex-start',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
