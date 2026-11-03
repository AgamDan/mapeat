import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import type { Person, PersonId } from '@/data/people';
import type { Photo } from '@/data/photos';
import { PhotoThumb } from '@/features/photos/photo-thumb';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

/** One decimal, without a trailing ".0" (8 → "8", 7.666 → "7.7"). */
export function formatAverage(value: number) {
  return String(Math.round(value * 10) / 10);
}

type PlaceSummaryProps = {
  people: Person[];
  averages: Record<PersonId, number | null>;
  visitCount: number;
  /** The couple's private journal cover, if one was chosen (never the public profile photo). */
  cover?: Photo | null;
};

const COVER_SIZE = 56;

/** Each person's own average for a place, side by side in their ink — never a combined score. */
export function PlaceSummary({ people, averages, visitCount, cover = null }: PlaceSummaryProps) {
  const theme = useTheme();
  const t = useT();

  return (
    <View style={[styles.box, { borderColor: theme.line, backgroundColor: theme.backgroundRaised }]}>
      {cover ? (
        <View style={styles.cover}>
          <PhotoThumb photo={cover} size={COVER_SIZE} />
          <View style={styles.coverText}>
            <ThemedText type="smallBold">{t('photos.isCover')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('photos.coverHint')}
            </ThemedText>
          </View>
        </View>
      ) : null}
      <View style={styles.header}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('place.average')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {visitCount === 1 ? t('place.visitCountOne') : t('place.visitCount', { count: visitCount })}
        </ThemedText>
      </View>
      <View style={styles.row}>
        {people.map((person, index) => {
          const average = averages[person.id];
          const ink = theme[person.color];
          return (
            <View
              key={person.id}
              accessible
              accessibilityLabel={`${person.name}, ${t('place.average')}: ${average === null ? '—' : formatAverage(average)}`}
              style={[
                styles.person,
                index > 0 && { borderStartWidth: StyleSheet.hairlineWidth, borderColor: theme.line },
              ]}>
              <ThemedText type="smallBold" style={{ color: ink }}>
                {person.name}
              </ThemedText>
              {average === null ? (
                <ThemedText style={styles.score} themeColor="textSecondary">
                  —
                </ThemedText>
              ) : (
                <ThemedText style={[styles.score, { color: ink }]}>{formatAverage(average)}</ThemedText>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  cover: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  coverText: {
    flex: 1,
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
  },
  person: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  score: {
    fontFamily: Fonts.black,
    fontSize: 34,
    lineHeight: 40,
  },
});
