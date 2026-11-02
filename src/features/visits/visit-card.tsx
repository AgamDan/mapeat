import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Postcard } from '@/components/postcard';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import type { Person } from '@/data/people';
import type { Visit, VisitReview } from '@/data/visits';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';
import { formatVisitDate } from '@/lib/dates';

type VisitCardProps = {
  visit: Visit;
  /** Both journal members in display order (from `usePeople()`). */
  people: Person[];
  /** Shown above the date, e.g. on the Timeline where cards come from many places. */
  placeName?: string | null;
  /** When true (default), tapping the date opens the visit screen. */
  openable?: boolean;
};

/**
 * One visit as a stamped postcard. Its "back" has two halves — one per person, each in their own
 * ink — so both reviews of the same visit are read together. In RTL the halves flip naturally.
 */
export function VisitCard({ visit, people, placeName, openable = true }: VisitCardProps) {
  const theme = useTheme();
  const { language } = useLanguage();
  const date = formatVisitDate(visit.visitDate, language, 'long');

  const heading = (
    <View style={styles.heading}>
      {placeName ? (
        <ThemedText type="smallBold" themeColor="textSecondary" numberOfLines={1}>
          {placeName}
        </ThemedText>
      ) : null}
      <ThemedText type="subtitle">{date}</ThemedText>
    </View>
  );

  return (
    <Postcard stamp={visit.visitDate.slice(0, 4)} style={styles.card}>
      {openable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={placeName ? `${placeName}, ${date}` : date}
          onPress={() => router.push({ pathname: '/visit/[id]', params: { id: visit.id } })}
          style={({ pressed }) => pressed && styles.pressed}>
          {heading}
        </Pressable>
      ) : (
        heading
      )}
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
    router.push({ pathname: '/visit/[id]/review', params: { id: visit.id, author: person.id } });

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
