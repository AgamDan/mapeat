import { router } from 'expo-router';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { MAX_PHOTOS_PER_VISIT } from '@/data/photos';
import type { Visit } from '@/data/visits';
import { useAddPhotos } from '@/features/photos/use-add-photos';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';
import { formatVisitDate } from '@/lib/dates';

/** Visits offered in the "Which visit?" choice (newest first). */
const VISIT_CHOICES = 6;

type Props = {
  placeId: string;
  /** The place's visits, newest first. */
  visits: readonly Visit[];
  /** Number of photos a visit already has. */
  photoCount: (visitId: string) => number;
};

/**
 * "Add photos" on the place page. Photos belong to a visit: with one visit they go to it; with
 * several, the user picks which; with none, the user is offered to add a visit first.
 */
export function PlaceAddPhotosButton({ placeId, visits, photoCount }: Props) {
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const t = useT();
  const { language } = useLanguage();
  const { add, adding } = useAddPhotos(null, 0);

  if (Platform.OS === 'web') return null;

  const addTo = (visit: Visit) =>
    add({
      target: { kind: 'visit', placeId, visitId: visit.id },
      remaining: Math.max(0, MAX_PHOTOS_PER_VISIT - photoCount(visit.id)),
    });

  const onPress = () => {
    if (visits.length === 0) {
      Alert.alert(
        t('photos.needVisit'),
        undefined,
        [
          { text: t('visit.cancel'), style: 'cancel' },
          { text: t('visit.add'), onPress: () => router.push({ pathname: '/visit/new', params: { placeId } }) },
        ],
        { userInterfaceStyle: scheme },
      );
      return;
    }
    if (visits.length === 1) {
      addTo(visits[0]);
      return;
    }
    Alert.alert(
      t('photos.whichVisit'),
      undefined,
      [
        ...visits.slice(0, VISIT_CHOICES).map((visit) => ({
          text: formatVisitDate(visit.visitDate, language, 'long'),
          onPress: () => addTo(visit),
        })),
        { text: t('visit.cancel'), style: 'cancel' as const },
      ],
      { userInterfaceStyle: scheme },
    );
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: adding, busy: adding }}
      disabled={adding}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.accent },
        (pressed || adding) && styles.pressed,
      ]}>
      {adding ? <ActivityIndicator color={theme.accent} /> : null}
      <ThemedText type="defaultBold" themeColor="accent">
        {adding ? t('photos.adding') : t('photos.add')}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
