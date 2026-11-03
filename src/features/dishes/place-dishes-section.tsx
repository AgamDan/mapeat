import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import type { DishVerdict, PlaceDishSummary } from '@/data/dishes';
import { usePlaceDishSummary } from '@/features/dishes/use-dishes';
import { usePeople } from '@/features/people/use-people';
import { useTheme } from '@/hooks/use-theme';
import type { TranslationKey } from '@/i18n/en';
import { useT } from '@/i18n/i18n';

const VERDICT_CHIP: Record<
  Exclude<DishVerdict, 'none'>,
  { label: TranslationKey; background: ThemeColor; text: ThemeColor }
> = {
  orderAgain: { label: 'dishes.orderAgain', background: 'sea', text: 'onAccent' },
  mixed: { label: 'dishes.mixed', background: 'chip', text: 'text' },
  skip: { label: 'dishes.skip', background: 'accent', text: 'onAccent' },
};

/**
 * "Our dishes here" on the place page: every dish ordered across visits with its verdict and
 * each person's latest 👍/👎. Renders nothing while loading or when the place has no dishes.
 */
export function PlaceDishesSection({ placeId }: { placeId: string }) {
  const t = useT();
  const theme = useTheme();
  const summary = usePlaceDishSummary(placeId);
  const { people } = usePeople();

  if (!summary || summary.length === 0) return null;

  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" accessibilityRole="header">
        {t('dishes.ourDishes')}
      </ThemedText>
      <View style={[styles.list, { borderColor: theme.line, backgroundColor: theme.backgroundRaised }]}>
        {summary.map((dish, index) => (
          <DishRow key={`${dish.name}-${index}`} dish={dish} first={index === 0} people={people} />
        ))}
      </View>
    </View>
  );
}

function DishRow({
  dish,
  first,
  people,
}: {
  dish: PlaceDishSummary;
  first: boolean;
  people: ReturnType<typeof usePeople>['people'];
}) {
  const t = useT();
  const theme = useTheme();
  const chip = dish.verdict === 'none' ? null : VERDICT_CHIP[dish.verdict];
  const voters = people.filter((person) => dish.latest[person.id] !== undefined);

  return (
    <View style={[styles.row, !first && { borderTopColor: theme.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.titleRow}>
        <ThemedText type="defaultBold" style={styles.name}>
          {dish.name}
        </ThemedText>
        {chip ? (
          <View style={[styles.chip, { backgroundColor: theme[chip.background] }]}>
            <ThemedText type="smallBold" style={{ color: theme[chip.text] }}>
              {t(chip.label)}
            </ThemedText>
          </View>
        ) : null}
      </View>
      {voters.length > 0 || dish.timesOrdered > 1 ? (
        <View style={styles.metaRow}>
          {voters.map((person) => {
            const up = dish.latest[person.id] === 1;
            return (
              <ThemedText
                key={person.id}
                type="smallBold"
                style={{ color: theme[person.color] }}
                accessibilityLabel={t(up ? 'dishes.voteUp' : 'dishes.voteDown', { name: person.name })}>
                {`${person.name} ${up ? '👍' : '👎'}`}
              </ThemedText>
            );
          })}
          {dish.timesOrdered > 1 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('dishes.timesOrdered', { count: dish.timesOrdered })}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
  },
  row: {
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
  },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
  },
});
