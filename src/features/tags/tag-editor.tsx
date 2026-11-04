import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { UserText } from '@/components/user-text';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { createTag, deleteTag, DuplicateTagError, MAX_TAG_LENGTH, renameTag, setPlaceTags, type Tag } from '@/data/journal';
import { JournalValidationError } from '@/data/visits';
import { useAllTags, usePlaceTags } from '@/features/tags/use-tags';
import { useTheme } from '@/hooks/use-theme';
import type { TranslationKey } from '@/i18n/en';
import { useLanguage, useT } from '@/i18n/i18n';

function errorKey(error: unknown): TranslationKey {
  if (error instanceof DuplicateTagError) return 'tags.duplicate';
  if (error instanceof JournalValidationError) return 'tags.invalid';
  return 'tags.saveFailed';
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * With `placeId`: choose that place's tags (each tap saves right away) and add new ones.
 * Without, or after "Manage tags": rename and delete tags for every place.
 */
export function TagEditor({ placeId }: { placeId?: string }) {
  const db = useSQLiteContext();
  const t = useT();
  const theme = useTheme();
  const { direction } = useLanguage();
  const { tags: allTags, error: allError, retry: retryAll } = useAllTags();
  const { tags: placeTags, error: placeError, retry: retryPlace } = usePlaceTags(placeId);

  const [managing, setManaging] = useState(!placeId);
  // Local selection after the first tap; until then the saved tags are shown.
  const [selection, setSelection] = useState<string[] | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [renaming, setRenaming] = useState(false);

  const choosing = !!placeId && !managing;
  const selected = new Set(selection ?? placeTags?.map((tag) => tag.id) ?? []);
  const loading = !allTags || (!!placeId && !placeTags);
  const loadFailed = loading && (allError || placeError);

  const saveSelection = async (next: string[]) => {
    if (!placeId) return;
    setSelection(next);
    try {
      await setPlaceTags(db, placeId, next);
    } catch {
      setSelection(null);
      Alert.alert(t('tags.saveFailed'));
    }
  };

  const toggle = (tag: Tag) => {
    const next = selected.has(tag.id)
      ? [...selected].filter((id) => id !== tag.id)
      : [...selected, tag.id];
    saveSelection(next);
  };

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setMessage(null);
    try {
      const tag = await createTag(db, newName);
      setNewName('');
      if (choosing && !selected.has(tag.id)) await saveSelection([...selected, tag.id]);
    } catch (error) {
      setMessage(errorKey(error));
    } finally {
      setCreating(false);
    }
  };

  const saveRename = async () => {
    if (!editing || renaming) return;
    setRenaming(true);
    setMessage(null);
    try {
      await renameTag(db, editing.id, editing.name);
      setEditing(null);
    } catch (error) {
      setMessage(errorKey(error));
    } finally {
      setRenaming(false);
    }
  };

  const confirmDelete = (tag: Tag) => {
    Alert.alert(t('tags.delete'), t('tags.deleteConfirm', { name: tag.name }), [
      { text: t('visit.cancel'), style: 'cancel' },
      {
        text: t('tags.delete'),
        style: 'destructive',
        onPress: () => {
          deleteTag(db, tag.id).then(
            () => {
              setSelection((current) => current?.filter((id) => id !== tag.id) ?? null);
              setEditing((current) => (current?.id === tag.id ? null : current));
            },
            () => Alert.alert(t('tags.saveFailed')),
          );
        },
      },
    ]);
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundRaised, borderColor: theme.line, writingDirection: direction },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.createRow}>
        <TextInput
          value={newName}
          onChangeText={(text) => {
            setNewName(text);
            if (message) setMessage(null);
          }}
          placeholder={t('tags.newPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={t('tags.newPlaceholder')}
          selectionColor={theme.accent}
          maxLength={MAX_TAG_LENGTH}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={() => {
            if (newName.trim()) create();
          }}
          editable={!creating}
          style={[inputStyle, styles.grow]}
        />
        <Pressable
          accessibilityRole="button"
          disabled={creating || !newName.trim()}
          onPress={create}
          style={({ pressed }) => [
            styles.addButton,
            { borderColor: theme.accent },
            (pressed || creating || !newName.trim()) && styles.dimmed,
          ]}>
          <ThemedText type="defaultBold" themeColor="accent">
            {t('tags.create')}
          </ThemedText>
        </Pressable>
      </View>

      {message ? (
        <ThemedText type="smallBold" themeColor="accent" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {t(message)}
        </ThemedText>
      ) : null}

      {loadFailed ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">{t('tags.loadFailed')}</ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              retryAll();
              retryPlace();
            }}
            style={({ pressed }) => [styles.outlineButton, { borderColor: theme.line }, pressed && styles.dimmed]}>
            <ThemedText type="defaultBold">{t('map.retry')}</ThemedText>
          </Pressable>
        </View>
      ) : loading ? (
        <ActivityIndicator color={theme.accent} />
      ) : allTags.length === 0 ? (
        <ThemedText themeColor="textSecondary">{t('tags.none')}</ThemedText>
      ) : (
        <View style={[styles.list, { borderColor: theme.line, backgroundColor: theme.card }]}>
          {allTags.map((tag, index) => {
            const separator = index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : null;
            if (choosing) {
              const on = selected.has(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => toggle(tag)}
                  style={({ pressed }) => [styles.row, separator, pressed && styles.dimmed]}>
                  <SymbolView
                    name={{
                      ios: on ? 'checkmark.circle.fill' : 'circle',
                      android: on ? 'check_circle' : 'radio_button_unchecked',
                      web: on ? 'check_circle' : 'radio_button_unchecked',
                    }}
                    size={22}
                    tintColor={on ? theme.accent : theme.textSecondary}
                  />
                  <UserText style={styles.grow}>{tag.name}</UserText>
                </Pressable>
              );
            }
            if (editing?.id === tag.id) {
              return (
                <View key={tag.id} style={[styles.row, styles.editRow, separator]}>
                  <TextInput
                    value={editing.name}
                    onChangeText={(name) => {
                      setEditing({ id: tag.id, name });
                      if (message) setMessage(null);
                    }}
                    accessibilityLabel={t('tags.rename')}
                    selectionColor={theme.accent}
                    maxLength={MAX_TAG_LENGTH}
                    autoFocus
                    returnKeyType="done"
                    submitBehavior="blurAndSubmit"
                    onSubmitEditing={saveRename}
                    editable={!renaming}
                    style={[inputStyle, styles.grow]}
                  />
                  <View style={styles.actions}>
                    <TextButton label={t('visit.cancel')} onPress={() => setEditing(null)} />
                    <TextButton label={t('tags.rename')} onPress={saveRename} strong disabled={renaming} />
                  </View>
                </View>
              );
            }
            return (
              <View key={tag.id} style={[styles.row, separator]}>
                <UserText style={styles.grow}>{tag.name}</UserText>
                <TextButton
                  label={t('tags.rename')}
                  onPress={() => {
                    setMessage(null);
                    setEditing({ id: tag.id, name: tag.name });
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t('tags.delete')}: ${tag.name}`}
                  onPress={() => confirmDelete(tag)}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.dimmed]}>
                  <SymbolView
                    name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                    size={18}
                    tintColor={theme.accent}
                  />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {placeId ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={Spacing.two}
          onPress={() => {
            setEditing(null);
            setMessage(null);
            setManaging(!managing);
          }}
          style={({ pressed }) => [styles.modeLink, pressed && styles.dimmed]}>
          <ThemedText type="smallBold" themeColor="accent">
            {managing ? t('tags.edit') : t('tags.manage')}
          </ThemedText>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={close}
        style={({ pressed }) => [styles.doneButton, { borderColor: theme.line }, pressed && styles.dimmed]}>
        <ThemedText type="defaultBold">{t('tags.done')}</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

function TextButton({
  label,
  onPress,
  strong = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, (pressed || disabled) && styles.dimmed]}>
      <ThemedText type={strong ? 'smallBold' : 'small'} themeColor="accent">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  grow: {
    flex: 1,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    fontFamily: Fonts.regular,
    fontSize: 17,
  },
  addButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  editRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.four,
  },
  center: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  outlineButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  modeLink: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  doneButton: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.6,
  },
});
