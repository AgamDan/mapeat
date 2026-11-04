import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { UserText } from '@/components/user-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import {
  addDish,
  deleteDish,
  MAX_DISH_NAME_LENGTH,
  renameDish,
  setDishVote,
  type Dish,
  type DishVote,
} from '@/data/dishes';
import type { Person } from '@/data/people';
import { useVisitDishes } from '@/features/dishes/use-dishes';
import { usePeople } from '@/features/people/use-people';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';
import { newId } from '@/lib/ids';
import { useSettings } from '@/settings/settings-provider';

type Submission = { submissionId: string; id: string };

function newSubmission(): Submission {
  return { submissionId: newId(), id: newId() };
}

/**
 * "Dishes" on the visit screen: the shared list of what was ordered, each person's own 👍/👎
 * per dish (tap the selected one again to remove the vote), tap a name to rename it, the trash
 * button (or a long press on the name) to delete it, and a field to add one.
 */
export function VisitDishesSection({ visitId }: { visitId: string }) {
  const db = useSQLiteContext();
  const t = useT();
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const { direction } = useLanguage();
  const { writer } = useSettings();
  const { people } = usePeople();
  const dishes = useVisitDishes(visitId);

  const [draft, setDraft] = useState('');
  // Kept until the add succeeds, so retrying a failed add never creates a second dish.
  const [submission, setSubmission] = useState(newSubmission);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const alertOptions = { userInterfaceStyle: scheme } as const;
  const fail = () => Alert.alert(t('dishes.saveFailed'), undefined, undefined, alertOptions);

  const canAdd = draft.trim().length > 0 && !adding;
  const add = async () => {
    if (!canAdd) return;
    setAdding(true);
    try {
      await addDish(db, { ...submission, visitId, name: draft, addedBy: writer });
      setDraft('');
      setSubmission(newSubmission());
    } catch {
      fail();
    } finally {
      setAdding(false);
    }
  };

  const commitRename = async (dish: Dish) => {
    if (!editing || editing.id !== dish.id) return;
    const text = editing.text.trim();
    setEditing(null);
    if (!text || text === dish.name) return;
    try {
      await renameDish(db, dish.id, text);
    } catch {
      fail();
    }
  };

  const vote = async (dish: Dish, person: Person, value: DishVote) => {
    try {
      await setDishVote(db, dish.id, person.id, dish.votes[person.id] === value ? null : value);
    } catch {
      fail();
    }
  };

  const confirmDelete = (dish: Dish) => {
    Alert.alert(
      t('dishes.delete'),
      t('dishes.deleteConfirm'),
      [
        { text: t('visit.cancel'), style: 'cancel' },
        {
          text: t('visit.delete'),
          style: 'destructive',
          onPress: () => {
            deleteDish(db, dish.id).catch(fail);
          },
        },
      ],
      alertOptions,
    );
  };

  const inputColors = {
    color: theme.text,
    backgroundColor: theme.background,
    borderColor: theme.line,
    writingDirection: direction,
  };

  return (
    <View style={[styles.panel, { borderColor: theme.line, backgroundColor: theme.backgroundRaised }]}>
      <ThemedText type="subtitle" accessibilityRole="header">
        {t('dishes.title')}
      </ThemedText>

      {dishes === undefined ? (
        <ActivityIndicator color={theme.accent} style={styles.loading} />
      ) : dishes.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('dishes.empty')}
        </ThemedText>
      ) : (
        dishes.map((dish) => (
          <View key={dish.id} style={[styles.dish, { borderColor: theme.line }]}>
            <View style={styles.nameRow}>
              {editing?.id === dish.id ? (
                <TextInput
                  value={editing.text}
                  onChangeText={(text) => setEditing({ id: dish.id, text })}
                  onSubmitEditing={() => commitRename(dish)}
                  onBlur={() => commitRename(dish)}
                  autoFocus
                  selectTextOnFocus
                  returnKeyType="done"
                  maxLength={MAX_DISH_NAME_LENGTH}
                  accessibilityLabel={t('dishes.rename')}
                  selectionColor={theme.accent}
                  style={[styles.input, styles.flex, inputColors]}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={t('dishes.rename')}
                  onPress={() => setEditing({ id: dish.id, text: dish.name })}
                  onLongPress={() => confirmDelete(dish)}
                  style={({ pressed }) => [styles.flex, styles.name, pressed && styles.pressed]}>
                  <UserText type="defaultBold">{dish.name}</UserText>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('dishes.delete')}: ${dish.name}`}
                onPress={() => confirmDelete(dish)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                <SymbolView
                  name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                  size={17}
                  tintColor={theme.textSecondary}
                />
              </Pressable>
            </View>
            <View style={styles.votes}>
              {people.map((person) => (
                <View key={person.id} style={styles.personVotes}>
                  <ThemedText type="smallBold" style={{ color: theme[person.color] }} numberOfLines={1}>
                    {person.name}
                  </ThemedText>
                  {([1, -1] as const).map((value) => {
                    const selected = dish.votes[person.id] === value;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityLabel={t(value === 1 ? 'dishes.voteUp' : 'dishes.voteDown', {
                          name: person.name,
                        })}
                        accessibilityState={{ selected }}
                        onPress={() => vote(dish, person, value)}
                        style={({ pressed }) => [
                          styles.vote,
                          {
                            borderColor: selected ? theme[person.color] : theme.line,
                            backgroundColor: selected ? theme[person.color] : 'transparent',
                          },
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText style={[styles.emoji, !selected && styles.unselected]}>
                          {value === 1 ? '👍' : '👎'}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        ))
      )}

      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder={t('dishes.placeholder')}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={t('dishes.placeholder')}
          selectionColor={theme.accent}
          maxLength={MAX_DISH_NAME_LENGTH}
          style={[styles.input, styles.flex, inputColors]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAdd, busy: adding }}
          disabled={!canAdd}
          onPress={add}
          style={({ pressed }) => [
            styles.addButton,
            { borderColor: theme.accent },
            (pressed || !canAdd) && styles.pressed,
          ]}>
          {adding ? <ActivityIndicator color={theme.accent} /> : null}
          <ThemedText type="defaultBold" themeColor="accent">
            {t('dishes.add')}
          </ThemedText>
        </Pressable>
      </View>
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
  loading: {
    alignSelf: 'flex-start',
  },
  flex: {
    flex: 1,
  },
  dish: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    minHeight: 44,
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  votes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.four,
    rowGap: Spacing.two,
  },
  personVotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  vote: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  unselected: {
    opacity: 0.45,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    fontFamily: Fonts.regular,
    fontSize: 17,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
