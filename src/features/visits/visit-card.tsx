import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Postcard } from '@/components/postcard';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import type { Person } from '@/data/people';
import type { Photo } from '@/data/photos';
import type { Visit, VisitReview } from '@/data/visits';
import { VisitPhotoStrip } from '@/features/photos/visit-photo-strip';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';
import { formatVisitDate } from '@/lib/dates';

type VisitCardProps = {
  visit: Visit;
  /** Both journal members in display order (from `usePeople()`). */
  people: Person[];
  /** Shown above the date, e.g. on the Timeline where cards come from many places. */
  placeName?: string | null;
  /** With `placeName`: tapping the name opens this place's page. */
  linkPlace?: boolean;
  /** When true (default), tapping the date opens the visit screen. */
  openable?: boolean;
  /**
   * The visit's photos for the thumbnail strip, when already batch-loaded (e.g. with
   * `getPhotosForVisits` for a list). If omitted, the card loads them itself.
   */
  photos?: Photo[];
  /** Shows the photo strip (default true); off where the photos are shown in full anyway. */
  showPhotos?: boolean;
};

/**
 * One visit as a stamped postcard. Its "back" has two halves — one per person, each in their own
 * ink — so both reviews of the same visit are read together. In RTL the halves flip naturally.
 */
export function VisitCard({
  visit,
  people,
  placeName,
  linkPlace = false,
  openable = true,
  photos,
  showPhotos = true,
}: VisitCardProps) {
  const theme = useTheme();
  const { language } = useLanguage();
  const date = formatVisitDate(visit.visitDate, language, 'long');

  const dateText = <ThemedText type="subtitle">{date}</ThemedText>;
  const place = placeName ? (
    linkPlace ? (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={placeName}
        hitSlop={8}
        onPress={() => router.push({ pathname: '/place/[id]', params: { id: visit.placeId } })}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="smallBold" themeColor="accent" numberOfLines={1}>
          {placeName}
        </ThemedText>
      </Pressable>
    ) : (
      <ThemedText type="smallBold" themeColor="textSecondary" numberOfLines={1}>
        {placeName}
      </ThemedText>
    )
  ) : null;

  return (
    <Postcard stamp={visit.visitDate.slice(0, 4)} style={styles.card}>
      <View style={styles.heading}>
        {place}
        {openable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={placeName ? `${placeName}, ${date}` : date}
            onPress={() => router.push({ pathname: '/visit/[id]', params: { id: visit.id } })}
            style={({ pressed }) => pressed && styles.pressed}>
            {dateText}
          </Pressable>
        ) : (
          dateText
        )}
      </View>
      {showPhotos ? <VisitPhotoStrip visitId={visit.id} photos={photos} openVisit={openable} /> : null}
      <View style={[styles.back, { borderTopColor: theme.line }]}>
        {people.map((person, index) => (
          <View
            key={person.id}
            style={[
              styles.half,
              index === 0
                ? styles.firstHalf
                : [styles.laterHalf, { borderStartColor: theme.line }],
            ]}>
            <ReviewHalf visit={visit} person={person} review={visit.reviews[person.id]} people={people} />
          </View>
        ))}
      </View>
    </Postcard>
  );
}

function ReviewHalf({
  visit,
  person,
  review,
  people,
}: {
  visit: Visit;
  person: Person;
  review: VisitReview | undefined;
  people: Person[];
}) {
  const theme = useTheme();
  const t = useT();
  const ink = theme[person.color];
  const openReview = () =>
    router.push({ pathname: '/visit/review', params: { id: visit.id, author: person.id } });

  if (!review) {
    return (
      <View style={styles.halfContent}>
        <ThemedText type="smallBold" style={{ color: ink }}>
          {person.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('visit.noReviewYet', { name: person.name })}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('visit.addReviewFor', { name: person.name })}
          onPress={openReview}
          style={({ pressed }) => [styles.addButton, { borderColor: ink }, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color: ink }}>
            {t('visit.addReviewFor', { name: person.name })}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  const editor =
    review.lastEditorId !== review.authorId
      ? people.find((candidate) => candidate.id === review.lastEditorId)
      : undefined;

  return (
    <View style={styles.halfContent}>
      <ThemedText type="smallBold" style={{ color: ink }}>
        {person.name}
      </ThemedText>
      <View
        style={styles.ratingRow}
        accessible
        accessibilityLabel={`${t('visit.rating')}: ${review.rating} / 10`}>
        <ThemedText style={[styles.rating, { color: ink }]}>{review.rating}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.outOf}>
          /10
        </ThemedText>
      </View>
      {review.notes ? <ThemedText>{review.notes}</ThemedText> : null}
      {editor ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('visit.editedBy', { name: editor.name })}
        </ThemedText>
      ) : null}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${t('visit.editReview')}: ${person.name}`}
        hitSlop={Spacing.two}
        onPress={openReview}
        style={({ pressed }) => [styles.editLink, pressed && styles.pressed]}>
        <ThemedText type="smallBold" style={{ color: ink }}>
          {t('visit.editReview')}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // The stamp sits in the top end corner; only the heading needs to keep clear of it.
  card: {
    paddingEnd: Spacing.three,
  },
  heading: {
    paddingEnd: 56,
    gap: Spacing.half,
  },
  back: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  half: {
    flex: 1,
  },
  firstHalf: {
    paddingEnd: Spacing.two,
  },
  laterHalf: {
    paddingStart: Spacing.two,
    borderStartWidth: StyleSheet.hairlineWidth,
  },
  halfContent: {
    gap: Spacing.one,
    alignItems: 'flex-start',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.half,
  },
  rating: {
    fontFamily: Fonts.black,
    fontSize: 40,
    lineHeight: 46,
  },
  // Keeps "/10" from being reordered to "10/" inside Hebrew text.
  outOf: {
    writingDirection: 'ltr',
  },
  addButton: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    marginTop: Spacing.one,
  },
  editLink: {
    paddingVertical: Spacing.half,
  },
  pressed: {
    opacity: 0.6,
  },
});
