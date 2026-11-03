import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { Postcard } from '@/components/postcard';
import { RatingPicker } from '@/components/rating-picker';
import { ThemedText } from '@/components/themed-text';
import { WriterSwitch } from '@/components/writer-switch';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { isValidRating, type VisitDraft } from '@/features/visits/drafts';
import { useTheme } from '@/hooks/use-theme';
import type { TranslationKey } from '@/i18n/en';
import { useLanguage, useT } from '@/i18n/i18n';

const RESTORED_NOTICE_MS = 5000;

export type ValidVisitDraft = VisitDraft & { rating: number };

type VisitFormProps = {
  /** What is being written about (place, visit, review author), shown above the fields. */
  header: ReactNode;
  draft: VisitDraft;
  onChange: (patch: Partial<VisitDraft>) => void;
  /** New visits choose their date; reviews belong to an existing visit's date. */
  showDate: boolean;
  /** Ink of the review's author, used for the chosen rating. */
  ratingColor: string;
  /** A draft from an earlier session was restored (shown briefly). */
  restored: boolean;
  /** There is unsaved work that can be thrown away. */
  canDiscard: boolean;
  onDiscard: () => Promise<void>;
  /**
   * Saves the draft (the rating is already checked). Resolves `null` on success (the screen then
   * closes) or the key of the message to show; the draft is kept either way until success.
   */
  onSubmit: (draft: ValidVisitDraft) => Promise<TranslationKey | null>;
};

/**
 * Returns a function that closes this visit/review modal (or goes to the map when it was opened
 * directly). It does nothing if the user already swiped the modal away while a save was running;
 * otherwise `router.back()` would close the screen underneath.
 */
export function useCloseVisitForm() {
  const navigation = useNavigation();
  return useCallback(() => {
    if (!navigation.isFocused()) return;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [navigation]);
}

/** The shared body of the new-visit and review screens. */
export function VisitForm({
  header,
  draft,
  onChange,
  showDate,
  ratingColor,
  restored,
  canDiscard,
  onDiscard,
  onSubmit,
}: VisitFormProps) {
  const theme = useTheme();
  const t = useT();
  const { direction } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [noticeHidden, setNoticeHidden] = useState(false);
  // Guards against a second tap landing before the "saving" state re-renders the button.
  const busy = useRef(false);

  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(() => setNoticeHidden(true), RESTORED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [restored]);

  const ratingMissing = error === 'visit.ratingRequired';

  async function save() {
    if (busy.current) return;
    const rating = draft.rating;
    if (!isValidRating(rating)) {
      setError('visit.ratingRequired');
      return;
    }
    Keyboard.dismiss();
    busy.current = true;
    setSaving(true);
    setError(null);
    let result: TranslationKey | null;
    try {
      result = await onSubmit({ ...draft, rating });
    } catch {
      result = 'visit.saveFailed';
    }
    // On success the screen closes; keep the button disabled until it does.
    if (result) {
      busy.current = false;
      setSaving(false);
      setError(result);
    }
  }

  function confirmDiscard() {
    Alert.alert(t('visit.discardDraft'), t('visit.discardDraftConfirm'), [
      { text: t('visit.cancel'), style: 'cancel' },
      {
        text: t('visit.discardDraft'),
        style: 'destructive',
        onPress: () => {
          busy.current = true;
          setSaving(true);
          onDiscard().catch(() => {
            busy.current = false;
            setSaving(false);
          });
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets>
      {header}

      {restored && !noticeHidden ? (
        <View
          style={[styles.notice, { backgroundColor: theme.chip }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          <ThemedText type="small">{t('visit.draftRestored')}</ThemedText>
        </View>
      ) : null}

      <Postcard style={styles.card}>
        {showDate ? (
          <DateField label={t('visit.date')} value={draft.visitDate} onChange={(visitDate) => onChange({ visitDate })} />
        ) : null}
        <WriterSwitch value={draft.writer} onChange={(writer) => onChange({ writer })} disabled={saving} />
        <RatingPicker
          label={t('visit.rating')}
          value={draft.rating}
          color={ratingColor}
          disabled={saving}
          invalid={ratingMissing}
          onChange={(rating) => {
            onChange({ rating });
            if (ratingMissing) setError(null);
          }}
        />
        <View style={styles.field}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('visit.notes')}
          </ThemedText>
          <TextInput
            value={draft.notes}
            onChangeText={(notes) => onChange({ notes })}
            placeholder={t('visit.notesPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t('visit.notes')}
            editable={!saving}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            selectionColor={theme.accent}
            style={[
              styles.notes,
              {
                color: theme.text,
                backgroundColor: theme.backgroundRaised,
                borderColor: theme.line,
                writingDirection: direction,
              },
            ]}
          />
        </View>
      </Postcard>

      {error ? (
        <ThemedText
          type="defaultBold"
          themeColor="accent"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive">
          {t(error)}
        </ThemedText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saving ? t('visit.saving') : t('visit.save')}
        accessibilityState={{ disabled: saving, busy: saving }}
        disabled={saving}
        onPress={save}
        style={({ pressed }) => [
          styles.saveButton,
          { backgroundColor: theme.accent },
          (pressed || saving) && styles.pressed,
        ]}>
        {saving ? <ActivityIndicator color={theme.onAccent} /> : null}
        <ThemedText type="defaultBold" style={{ color: theme.onAccent }}>
          {saving ? t('visit.saving') : t('visit.save')}
        </ThemedText>
      </Pressable>

      {canDiscard ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={confirmDiscard}
          style={({ pressed }) => [styles.discardButton, pressed && styles.pressed]}>
          <ThemedText type="defaultBold" themeColor="textSecondary">
            {t('visit.discardDraft')}
          </ThemedText>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  notice: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
  },
  card: {
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.two,
  },
  notes: {
    minHeight: 120,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 50,
    borderRadius: Radius.small,
  },
  discardButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  pressed: {
    opacity: 0.7,
  },
});
