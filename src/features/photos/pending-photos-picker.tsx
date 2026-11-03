import type { ImagePickerAsset } from 'expo-image-picker';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { MAX_PHOTOS_PER_VISIT } from '@/data/photos';
import { pickPhotos, type PhotoSource } from '@/features/photos/add-photos';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

const THUMB = 72;

type Props = {
  assets: readonly ImagePickerAsset[];
  onChange: (assets: ImagePickerAsset[]) => void;
  disabled?: boolean;
};

/**
 * "Our photos" in the new-visit form: photos picked here are previewed and saved to the visit
 * right after the visit itself is saved (see `addPickedPhotos`).
 */
export function PendingPhotosPicker({ assets, onChange, disabled = false }: Props) {
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const t = useT();
  const remaining = MAX_PHOTOS_PER_VISIT - assets.length;

  if (Platform.OS === 'web') return null;

  const pick = async (source: PhotoSource) => {
    const result = await pickPhotos(source, remaining).catch(() => null);
    if (!result) {
      Alert.alert(t('photos.addFailed'), undefined, undefined, { userInterfaceStyle: scheme });
      return;
    }
    if (result.status === 'denied') {
      Alert.alert(t('photos.cameraDenied'), undefined, undefined, { userInterfaceStyle: scheme });
      return;
    }
    if (result.status === 'picked') onChange([...assets, ...result.assets].slice(0, MAX_PHOTOS_PER_VISIT));
  };

  const add = () => {
    if (remaining <= 0) {
      Alert.alert(t('photos.limitReached', { max: MAX_PHOTOS_PER_VISIT }), undefined, undefined, {
        userInterfaceStyle: scheme,
      });
      return;
    }
    Alert.alert(
      t('photos.add'),
      undefined,
      [
        { text: t('photos.takePhoto'), onPress: () => void pick('camera') },
        { text: t('photos.chooseFromLibrary'), onPress: () => void pick('library') },
        { text: t('visit.cancel'), style: 'cancel' },
      ],
      { userInterfaceStyle: scheme },
    );
  };

  return (
    <View style={[styles.panel, { borderColor: theme.line, backgroundColor: theme.backgroundRaised }]}>
      <View style={styles.heading}>
        <ThemedText type="subtitle" style={styles.title}>
          {t('photos.ourPhotos')}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.count}>
          {`${assets.length}/${MAX_PHOTOS_PER_VISIT}`}
        </ThemedText>
      </View>

      {assets.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {assets.map((asset, index) => (
            <View key={`${asset.uri}:${index}`}>
              <Image source={{ uri: asset.uri }} style={[styles.thumb, { backgroundColor: theme.chip }]} contentFit="cover" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('photos.removePending')}
                disabled={disabled}
                hitSlop={8}
                onPress={() => onChange(assets.filter((_, i) => i !== index))}
                style={[styles.remove, { backgroundColor: theme.card, borderColor: theme.line }]}>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={11} tintColor={theme.text} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('photos.savedWithVisit')}
        </ThemedText>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={add}
        style={({ pressed }) => [styles.button, { borderColor: theme.accent }, (pressed || disabled) && styles.pressed]}>
        <ThemedText type="defaultBold" themeColor="accent">
          {t('photos.add')}
        </ThemedText>
      </Pressable>
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
  row: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingEnd: Spacing.two,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: Radius.small,
  },
  remove: {
    position: 'absolute',
    top: -6,
    end: -6,
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
