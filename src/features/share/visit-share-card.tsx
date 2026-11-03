import { Image } from 'expo-image';
import { type ComponentRef, type Ref, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Postcard } from '@/components/postcard';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import type { Person } from '@/data/people';
import type { Photo } from '@/data/photos';
import type { Visit } from '@/data/visits';
import { photoUri } from '@/features/photos/photo-files';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';
import { formatVisitDate } from '@/lib/dates';

/** Size in points; captured at the iPhone's 3× scale this is a 1080 × 1350 px (4:5) image. */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 450;
const PHOTO_GAP = Spacing.two;
const OUTER_PADDING = Spacing.four;
const CARD_PADDING = Spacing.three;
const PHOTO_SIZE = (SHARE_CARD_WIDTH - 2 * OUTER_PADDING - 2 * CARD_PADDING - 2 * PHOTO_GAP) / 3;

type VisitShareCardProps = {
  ref?: Ref<ComponentRef<typeof View>>;
  visit: Visit;
  people: Person[];
  placeName: string;
  /** At most three of the visit's photos. */
  photos: Photo[];
  /** Called once the card is laid out and every photo has loaded (or failed). */
  onReady: () => void;
};

/**
 * The visit drawn as a fixed-size postcard image for sharing: place, date, both reviews in each
 * person's own ink, a few photos and the app footer. Rendered only to be captured.
 */
export function VisitShareCard({ ref, visit, people, placeName, photos, onReady }: VisitShareCardProps) {
  const theme = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const [laidOut, setLaidOut] = useState(false);
  const [settled, setSettled] = useState(0);
  const ready = laidOut && settled >= photos.length;

  useEffect(() => {
    if (ready) onReady();
  }, [ready, onReady]);

  const settle = () => setSettled((count) => count + 1);

  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={() => setLaidOut(true)}
      style={[styles.canvas, { backgroundColor: theme.background }]}>
      <Postcard stamp={visit.visitDate.slice(0, 4)} style={styles.card}>
        <View style={styles.heading}>
          <ThemedText type="title" numberOfLines={2} allowFontScaling={false}>
            {placeName}
          </ThemedText>
          <ThemedText type="subtitle" themeColor="textSecondary" allowFontScaling={false}>
            {formatVisitDate(visit.visitDate, language, 'long')}
          </ThemedText>
        </View>

        {photos.length > 0 ? (
          <View style={styles.photos}>
            {photos.map((photo) => (
              <Image
                key={photo.id}
                source={{ uri: photoUri(photo.fileName) }}
                style={[styles.photo, { backgroundColor: theme.chip }]}
                contentFit="cover"
                transition={0}
                onLoad={settle}
                onError={settle}
              />
            ))}
          </View>
        ) : null}

        <View style={[styles.back, { borderTopColor: theme.line }]}>
          {people.map((person, index) => {
            const review = visit.reviews[person.id];
            const ink = theme[person.color];
            return (
              <View
                key={person.id}
                style={[
                  styles.half,
                  index === 0 ? styles.firstHalf : [styles.laterHalf, { borderStartColor: theme.line }],
                ]}>
                <ThemedText type="smallBold" style={{ color: ink }} allowFontScaling={false}>
                  {person.name}
                </ThemedText>
                {review ? (
                  <>
                    <View style={styles.ratingRow}>
                      <ThemedText style={[styles.rating, { color: ink }]} allowFontScaling={false}>
                        {review.rating}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={styles.outOf}
                        allowFontScaling={false}>
                        /10
                      </ThemedText>
                    </View>
                    {review.notes ? (
                      <ThemedText
                        type="small"
                        numberOfLines={photos.length > 0 ? 4 : 10}
                        allowFontScaling={false}>
                        {review.notes}
                      </ThemedText>
                    ) : null}
                  </>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary" allowFontScaling={false}>
                    {t('visit.noReviewYet', { name: person.name })}
                  </ThemedText>
                )}
              </View>
            );
          })}
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.footer} allowFontScaling={false}>
          {t('share.footer')}
        </ThemedText>
      </Postcard>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    padding: OUTER_PADDING,
  },
  card: {
    flex: 1,
    padding: CARD_PADDING,
    paddingTop: Spacing.four,
    paddingEnd: CARD_PADDING,
  },
  heading: {
    paddingEnd: 56,
    gap: Spacing.half,
  },
  photos: {
    flexDirection: 'row',
    gap: PHOTO_GAP,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: Radius.small,
  },
  back: {
    flex: 1,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    overflow: 'hidden',
  },
  half: {
    flex: 1,
    gap: Spacing.half,
    alignItems: 'flex-start',
  },
  firstHalf: {
    paddingEnd: Spacing.two,
  },
  laterHalf: {
    paddingStart: Spacing.two,
    borderStartWidth: StyleSheet.hairlineWidth,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.half,
  },
  rating: {
    fontFamily: Fonts.displayHeavy,
    fontSize: 40,
    lineHeight: 46,
  },
  // Keeps "/10" from being reordered to "10/" inside Hebrew text.
  outOf: {
    writingDirection: 'ltr',
  },
  footer: {
    textAlign: 'center',
  },
});
